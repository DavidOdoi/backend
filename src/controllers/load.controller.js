const { Load } = require("../models/load.model");
const { Driver } = require("../models/driver.model");
const { validateCreate, validateUpdate, validateAssign } = require("../validators/load.validator");
const { findMatches } = require("../services/matching.service");
const { geocodeLocation, enrichDriversWithDistance } = require("../services/distance.service");

const createError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

const isDriverLikeRole = (role) => role === "driver" || role === "staff";

function appendStatusHistory(load, status, options = {}) {
  if (!load) return;
  if (!Array.isArray(load.statusHistory)) {
    load.statusHistory = [];
  }
  load.statusHistory.push({
    status,
    note: options.note,
    location: options.location,
    changedByRole: options.changedByRole,
    timestamp: new Date()
  });
}

async function createLoad(req, res) {
  console.log("=== CREATE LOAD ENDPOINT ===");
  console.log("Request body:", JSON.stringify(req.body, null, 2));
  
  try {
    const payload = validateCreate(req.body);
    console.log("Validation passed, payload:", JSON.stringify(payload, null, 2));
    
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
    console.log("Load created successfully:", load._id);

    return res.status(201).json({
      success: true,
      data: load,
      message: "Load created"
    });
  } catch (error) {
    console.error("Error creating load:", error);
    throw error;
  }
}

async function trackLoadByTrackingId(req, res) {
  const trackingId = req.params.trackingId?.toString().trim().toUpperCase();
  if (!trackingId) {
    throw createError(400, "Tracking ID is required");
  }

  const load = await Load.findOne({ trackingId })
    .populate("assignedDriver", "name phone currentLocation")
    .select(
      "trackingId pickupLocation pickupCity deliveryLocation deliveryCity cargoType weight status statusHistory assignedDriver createdAt updatedAt"
    );

  if (!load) {
    throw createError(404, "Tracking ID not found");
  }

  return res.json({
    success: true,
    data: load
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
  if (req.user && req.query.assigned === "me" && isDriverLikeRole(req.user.role) && req.user.driverProfile) {
    query.assignedDriver = req.user.driverProfile;
  }

  const loads = await Load.find(query)
    .populate("assignedDriver", "name truckTypes rating currentLocation availability")
    .populate("postedBy", "name email role")
    .sort({ createdAt: -1 });
  return res.json({
    success: true,
    data: loads
  });
}

async function getLoad(req, res) {
  const load = await Load.findById(req.params.id)
    .populate("assignedDriver", "name truckTypes rating currentLocation availability")
    .populate("postedBy", "name email role");
  if (!load) {
    throw createError(404, "Load not found");
  }

  return res.json({
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

  return res.json({
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

  return res.json({
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

  appendStatusHistory(load, "assigned", {
    note: "Driver assigned",
    location: load.assignedDriver?.currentLocation || load.pickupCity || load.pickupLocation,
    changedByRole: req.user?.role || "admin"
  });
  await load.save();

  return res.json({
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

  return res.json({
    success: true,
    data: matches
  });
}

async function acceptLoad(req, res) {
  if (!req.user || !isDriverLikeRole(req.user.role) || !req.user.driverProfile) {
    throw createError(403, "Driver account required");
  }

  const load = await Load.findById(req.params.id);
  if (!load) throw createError(404, "Load not found");
  if (load.status !== "open") throw createError(400, "Load is not open");

  load.assignedDriver = req.user.driverProfile;
  load.status = "assigned";
  appendStatusHistory(load, "assigned", {
    note: "Driver accepted load",
    location: load.pickupCity || load.pickupLocation,
    changedByRole: req.user.role
  });
  await load.save();

  const populated = await load.populate("assignedDriver", "name truckTypes rating currentLocation availability");

  return res.json({ success: true, data: populated, message: "Load accepted" });
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
    isDriverLikeRole(req.user.role) &&
    load.assignedDriver &&
    load.assignedDriver.toString() === req.user.driverProfile?.toString();
  const isAdmin = req.user && req.user.role === "admin";

  if (!isOwner && !isAssignedDriver && !isAdmin) {
    throw createError(403, "Not allowed to change status");
  }

  load.status = status;
  appendStatusHistory(load, status, {
    note: "Shipment status updated",
    location: status === "delivered"
      ? load.deliveryCity || load.deliveryLocation
      : load.assignedDriver?.currentLocation || load.pickupCity || load.pickupLocation,
    changedByRole: req.user?.role
  });
  await load.save();
  const populated = await load
    .populate("assignedDriver", "name truckTypes rating currentLocation availability")
    .populate("postedBy", "name email role");

  return res.json({ success: true, data: populated, message: "Status updated" });
}

module.exports = {
  createLoad,
  trackLoadByTrackingId,
  getLoads,
  getLoad,
  updateLoad,
  deleteLoad,
  assignDriver,
  getLoadMatches,
  acceptLoad,
  updateStatus
};
