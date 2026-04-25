const { Load } = require("../models/load.model");
const { Driver } = require("../models/driver.model");
const { validateCreate, validateUpdate, validateAssign } = require("../validators/load.validator");
const { findMatches } = require("../services/matching.service");
const { geocodeLocation, enrichDriversWithDistance } = require("../services/distance.service");
const { sendStatusUpdate, notifyTrader } = require("../services/sms.service");

const createError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

async function createLoad(req, res) {
  const payload = validateCreate(req.body);
  if (req.user) {
    payload.postedBy = req.user._id;
  }
  const pickupQuery = payload.pickupLocation || payload.pickupCity;
  const deliveryQuery = payload.deliveryLocation || payload.deliveryCity;
  if (pickupQuery) {
    const pickupGeo = await geocodeLocation(pickupQuery);
    if (pickupGeo) payload.pickupGeo = pickupGeo;
  }
  if (deliveryQuery) {
    const deliveryGeo = await geocodeLocation(deliveryQuery);
    if (deliveryGeo) payload.deliveryGeo = deliveryGeo;
  }
  const load = await Load.create(payload);

  res.status(201).json({
    success: true,
    data: load,
    message: "Load created"
  });
}

async function getLoads(req, res) {
  const query = {};
  if (req.query.status) {
    query.status = req.query.status;
  }
  if (req.user && req.query.mine === "true") {
    query.postedBy = req.user._id;
  }
  if (req.user && req.query.assigned === "me" && req.user.role === "driver" && req.user.driverProfile) {
    query.assignedDriver = req.user.driverProfile;
  }

  const loads = await Load.find(query)
    .populate("assignedDriver", "name truckTypes rating currentLocation availability phone")
    .populate("postedBy", "name email role phone")
    .sort({ createdAt: -1 });
  res.json({
    success: true,
    data: loads
  });
}

async function getLoad(req, res) {
  const load = await Load.findById(req.params.id)
    .populate("assignedDriver", "name truckTypes rating currentLocation availability phone")
    .populate("postedBy", "name email role phone");
  if (!load) {
    throw createError(404, "Load not found");
  }

  res.json({
    success: true,
    data: load
  });
}

async function updateLoad(req, res) {
  const updates = validateUpdate(req.body);

  const load = await Load.findById(req.params.id);
  if (!load) throw createError(404, "Load not found");

  if (req.user && req.user.role !== "admin") {
    const isOwner = load.postedBy && load.postedBy.toString() === req.user._id.toString();
    if (!isOwner) {
      throw createError(403, "Not allowed to update this load");
    }
  }

  Object.assign(load, updates);
  if (updates.pickupLocation || updates.pickupCity) {
    const pickupGeo = await geocodeLocation(updates.pickupLocation || updates.pickupCity);
    if (pickupGeo) load.pickupGeo = pickupGeo;
  }
  if (updates.deliveryLocation || updates.deliveryCity) {
    const deliveryGeo = await geocodeLocation(updates.deliveryLocation || updates.deliveryCity);
    if (deliveryGeo) load.deliveryGeo = deliveryGeo;
  }
  await load.save();

  if (!load) {
    throw createError(404, "Load not found");
  }

  res.json({
    success: true,
    data: load,
    message: "Load updated"
  });
}

async function deleteLoad(req, res) {
  const load = await Load.findById(req.params.id);
  if (!load) {
    throw createError(404, "Load not found");
  }

  if (req.user && req.user.role !== "admin") {
    const isOwner = load.postedBy && load.postedBy.toString() === req.user._id.toString();
    if (!isOwner) {
      throw createError(403, "Not allowed to delete this load");
    }
  }

  await load.deleteOne();

  res.json({
    success: true,
    data: load,
    message: "Load deleted"
  });
}

async function assignDriver(req, res) {
  const { driverId } = validateAssign(req.body);

  const driver = await Driver.findById(driverId);
  if (!driver) {
    throw createError(404, "Driver not found");
  }

  const load = await Load.findByIdAndUpdate(
    req.params.id,
    { assignedDriver: driverId, status: "assigned" },
    { new: true, runValidators: true }
  ).populate("assignedDriver", "name truckTypes rating currentLocation availability");

  if (!load) {
    throw createError(404, "Load not found");
  }

  res.json({
    success: true,
    data: load,
    message: "Driver assigned"
  });
}

async function getLoadMatches(req, res) {
  const load = await Load.findById(req.params.id);
  if (!load) {
    throw createError(404, "Load not found");
  }

  const limit = Number(req.query.limit) || 5;
  const drivers = await Driver.find({ "availability.status": "available" });
  const enriched = await enrichDriversWithDistance(load, drivers);
  const matches = findMatches(load, enriched, limit, { strict: true });

  res.json({
    success: true,
    data: matches
  });
}

async function acceptLoad(req, res) {
  if (!req.user || req.user.role !== "driver" || !req.user.driverProfile) {
    throw createError(403, "Driver account required");
  }

  const load = await Load.findById(req.params.id);
  if (!load) throw createError(404, "Load not found");
  if (load.status !== "open") throw createError(400, "Load is not open");

  load.assignedDriver = req.user.driverProfile;
  load.status = "assigned";
  await load.save();

  const populated = await load
    .populate("assignedDriver", "name truckTypes rating currentLocation availability phone")
    .populate("postedBy", "name email role phone");

  const traderPhone = populated.contactPhone || populated.deliveryPhone || populated.postedBy?.phone;
  const driver = await Driver.findById(req.user.driverProfile).select("name phone");
  let notification = { sent: false, phone: traderPhone || null, error: null };

  if (traderPhone) {
    try {
      const result = await notifyTrader(traderPhone, driver || { name: "Driver", phone: "N/A" }, populated);
      notification.sent = Boolean(result?.success);
      notification.details = result;
    } catch (notificationError) {
      notification.error = notificationError?.message || notificationError;
      console.warn("Failed to notify trader on load acceptance:", notification.error);
    }
  } else {
    notification.error = "No trader phone available";
    console.warn("Accept load: unable to notify trader because no trader phone was found", { loadId: load._id });
  }

  res.json({
    success: true,
    data: populated,
    notification,
    message: notification.sent ? "Load accepted and trader notified" : "Load accepted; trader notification was not sent"
  });
}

async function updateStatus(req, res) {
  const { status } = req.body;
  const allowed = ["open", "assigned", "in_transit", "delivered", "cancelled"];
  if (!allowed.includes(status)) throw createError(400, "Invalid status");

  const load = await Load.findById(req.params.id);
  if (!load) throw createError(404, "Load not found");

  // Only assigned driver or owner or admin
  const isOwner = req.user && load.postedBy && load.postedBy.toString() === req.user._id.toString();
  const isAssignedDriver =
    req.user &&
    req.user.role === "driver" &&
    load.assignedDriver &&
    load.assignedDriver.toString() === req.user.driverProfile?.toString();
  const isAdmin = req.user && req.user.role === "admin";

  if (!isOwner && !isAssignedDriver && !isAdmin) {
    throw createError(403, "Not allowed to change status");
  }

  const previousStatus = load.status;
  load.status = status;
  await load.save();

  // Keep driver trip stats in sync
  if (load.assignedDriver) {
    if (status === "delivered" && previousStatus !== "delivered") {
      await Driver.findByIdAndUpdate(load.assignedDriver, {
        $inc: { totalTrips: 1, completedTrips: 1 }
      });
    } else if (status === "cancelled" && previousStatus !== "cancelled") {
      await Driver.findByIdAndUpdate(load.assignedDriver, {
        $inc: { totalTrips: 1, cancelledTrips: 1 }
      });
    }
  }

  const populated = await load
    .populate("assignedDriver", "name truckTypes rating currentLocation availability")
    .populate("postedBy", "name email role");

  res.json({ success: true, data: populated, message: "Status updated" });
}

async function contactCustomer(req, res) {
  const { phone } = req.body;
  
  if (!phone || typeof phone !== 'string') {
    throw createError(400, "Phone number is required");
  }

  if (!req.user || req.user.role !== "driver" || !req.user.driverProfile) {
    throw createError(403, "Driver account required");
  }

  const load = await Load.findById(req.params.id);
  if (!load) throw createError(404, "Load not found");

  // Verify driver is assigned to this load
  if (!load.assignedDriver || load.assignedDriver.toString() !== req.user.driverProfile.toString()) {
    throw createError(403, "Not assigned to this load");
  }

  try {
    const driver = await Driver.findById(req.user.driverProfile);
    const message = `Your cargo from ${load.pickupLocation} to ${load.deliveryLocation} is on the way. Driver ${driver?.name || 'will'} contact you soon. Driver phone: ${driver?.phone || 'N/A'}`;
    
    // Send SMS if enabled
    await sendStatusUpdate(phone, 'in_transit', load);
    
    res.json({ 
      success: true, 
      message: "Customer notified",
      data: { contacted: true, phone }
    });
  } catch (err) {
    throw createError(500, "Failed to contact customer: " + err.message);
  }
}

module.exports = {
  createLoad,
  getLoads,
  getLoad,
  updateLoad,
  deleteLoad,
  assignDriver,
  getLoadMatches,
  acceptLoad,
  updateStatus,
  contactCustomer
};
