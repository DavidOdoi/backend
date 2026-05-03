const { Load } = require("../models/load.model");
const { Driver } = require("../models/driver.model");
const { User } = require("../models/user.model");
const { validateCreate, validateUpdate, validateAssign } = require("../validators/load.validator");
const { findMatches } = require("../services/matching.service");
const { geocodeLocation, enrichDriversWithDistance } = require("../services/distance.service");
const { getDirections } = require("../services/routing.service");
const { dispatchNotification } = require("../services/notify.service");

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

function buildWhatsAppLink(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  const e164 = digits.startsWith("0") && digits.length === 10
    ? `256${digits.slice(1)}`
    : digits;
  return `https://wa.me/${e164}`;
}

function buildContactLinks(phone, email) {
  const links = {};
  if (phone) {
    const digits = phone.replace(/\D/g, "");
    const e164 = digits.startsWith("0") && digits.length === 10
      ? `+256${digits.slice(1)}`
      : `+${digits}`;
    links.call = `tel:${e164}`;
    links.sms = `sms:${e164}`;
    links.whatsapp = buildWhatsAppLink(phone);
  }
  if (email) {
    links.email = `mailto:${email}`;
  }
  return links;
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

// Returns open loads that match the authenticated driver, scored and sorted
async function getAvailableLoads(req, res) {
  if (!req.user || !isDriverLikeRole(req.user.role) || !req.user.driverProfile) {
    throw createError(403, "Driver account required");
  }

  const driver = await Driver.findById(req.user.driverProfile);
  if (!driver) throw createError(404, "Driver profile not found");

  // Pre-filter at DB level before expensive scoring
  const filter = { status: "open" };
  if (driver.truckTypes?.length > 0) {
    filter.$or = [
      { truckType: { $in: driver.truckTypes } },
      { truckType: { $exists: false } },
      { truckType: null },
      { truckType: "" }
    ];
  }
  if (driver.maxWeight) {
    filter.weight = { $lte: driver.maxWeight };
  }

  const openLoads = await Load.find(filter)
    .populate("postedBy", "name email phone companyName")
    .sort({ createdAt: -1 })
    .limit(100);

  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const scored = [];

  for (const load of openLoads) {
    const enriched = await enrichDriversWithDistance(load, [driver]);
    const matches = findMatches(load, enriched, 1, { strict: true });
    if (matches.length > 0) {
      const m = matches[0];
      const trader = load.postedBy;
      scored.push({
        load,
        score: m.score,
        reasons: m.reasons,
        distanceKm: m.distanceKm,
        durationMin: m.durationMin,
        estimatedFare: m.estimatedFare,
        traderContact: trader
          ? {
              name: trader.name,
              company: trader.companyName || null,
              links: buildContactLinks(trader.phone, trader.email)
            }
          : null
      });
    }
  }

  scored.sort((a, b) => b.score - a.score);

  return res.json({ success: true, data: scored.slice(0, limit) });
}

// Returns trader contact details (phone/WhatsApp/email links) for a load
async function getLoadContact(req, res) {
  if (!req.user) throw createError(401, "Unauthorized");

  const load = await Load.findById(req.params.id)
    .populate("postedBy", "name email phone companyName");
  if (!load) throw createError(404, "Load not found");

  const isAssigned =
    load.assignedDriver &&
    req.user.driverProfile &&
    load.assignedDriver.toString() === req.user.driverProfile.toString();
  const isOpenAndDriver = load.status === "open" && isDriverLikeRole(req.user.role);
  const isAdmin = req.user.role === "admin";
  const isOwner =
    load.postedBy &&
    load.postedBy._id?.toString() === req.user._id.toString();

  if (!isAssigned && !isOpenAndDriver && !isAdmin && !isOwner) {
    throw createError(403, "Not authorized to view contact details");
  }

  const trader = load.postedBy;
  const phone = trader?.phone || load.contactPhone || null;
  const email = trader?.email || null;

  return res.json({
    success: true,
    data: {
      name: trader?.name || load.contactName || "Trader",
      company: trader?.companyName || null,
      phone,
      email,
      links: buildContactLinks(phone, email)
    }
  });
}

async function acceptLoad(req, res) {
  if (!req.user || !isDriverLikeRole(req.user.role) || !req.user.driverProfile) {
    throw createError(403, "Driver account required");
  }

  const load = await Load.findById(req.params.id).populate("postedBy", "name email phone _id");
  if (!load) throw createError(404, "Load not found");
  if (load.status !== "open") throw createError(400, "Load is not open");

  const driver = await Driver.findById(req.user.driverProfile);

  load.assignedDriver = req.user.driverProfile;
  load.status = "assigned";
  appendStatusHistory(load, "assigned", {
    note: "Driver accepted load",
    location: load.pickupCity || load.pickupLocation,
    changedByRole: req.user.role
  });
  await load.save();

  const populated = await Load.findById(load._id)
    .populate("assignedDriver", "name truckTypes rating currentLocation availability phone email")
    .populate("postedBy", "name email phone companyName");

  // Notify the trader — fire-and-forget
  if (load.postedBy?._id) {
    const trader = load.postedBy;
    const driverName = driver?.name || req.user.name || "A driver";
    const route = [
      load.pickupCity || load.pickupLocation,
      load.deliveryCity || load.deliveryLocation
    ]
      .filter(Boolean)
      .join(" → ");

    dispatchNotification({
      recipientId: trader._id,
      recipientEmail: trader.email,
      recipientPhone: trader.phone,
      type: "load_accepted",
      title: "Load Accepted",
      body: `Your load (${load.trackingId}) — ${route} — has been accepted by ${driverName}. They are on their way.`,
      data: {
        loadId: load._id,
        trackingId: load.trackingId,
        driverId: req.user.driverProfile,
        driverName
      }
    }).catch((err) => console.error("[acceptLoad] notify error:", err.message));
  }

  return res.json({ success: true, data: populated, message: "Load accepted" });
}

async function updateStatus(req, res) {
  const { status } = req.body;
  const allowed = ["open", "assigned", "in_transit", "delivered", "cancelled"];
  if (!allowed.includes(status)) throw createError(400, "Invalid status");

  const load = await Load.findById(req.params.id)
    .populate("postedBy", "name email phone _id")
    .populate("assignedDriver", "name phone email");
  if (!load) throw createError(404, "Load not found");

  const isOwner = req.user && load.postedBy && load.postedBy._id?.toString() === req.user._id.toString();
  const isAssignedDriver =
    req.user &&
    isDriverLikeRole(req.user.role) &&
    load.assignedDriver &&
    load.assignedDriver._id?.toString() === req.user.driverProfile?.toString();
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

  const populated = await Load.findById(load._id)
    .populate("assignedDriver", "name truckTypes rating currentLocation availability phone email")
    .populate("postedBy", "name email phone companyName");

  const route = [
    load.pickupCity || load.pickupLocation,
    load.deliveryCity || load.deliveryLocation
  ]
    .filter(Boolean)
    .join(" → ");

  const statusLabels = {
    open: "Open",
    assigned: "Assigned",
    in_transit: "In Transit",
    delivered: "Delivered",
    cancelled: "Cancelled"
  };

  // Notify trader on every status change
  if (load.postedBy?._id) {
    const trader = load.postedBy;
    dispatchNotification({
      recipientId: trader._id,
      recipientEmail: trader.email,
      recipientPhone: trader.phone,
      type: "status_update",
      title: `Shipment ${statusLabels[status] || status}`,
      body: `Your load (${load.trackingId}) — ${route} — is now ${statusLabels[status] || status}.`,
      data: { loadId: load._id, trackingId: load.trackingId, status }
    }).catch((err) => console.error("[updateStatus] trader notify error:", err.message));
  }

  // Notify driver on trader actions (cancellation, reassignment)
  if (load.assignedDriver && isOwner) {
    const assignedDriver = load.assignedDriver;
    const driverUser = await User.findOne({ driverProfile: assignedDriver._id }).select("email phone _id");
    if (driverUser) {
      dispatchNotification({
        recipientId: driverUser._id,
        recipientEmail: driverUser.email,
        recipientPhone: driverUser.phone,
        type: "status_update",
        title: `Load ${statusLabels[status] || status}`,
        body: `Load (${load.trackingId}) — ${route} — status changed to ${statusLabels[status] || status}.`,
        data: { loadId: load._id, trackingId: load.trackingId, status }
      }).catch((err) => console.error("[updateStatus] driver notify error:", err.message));
    }
  }

  return res.json({ success: true, data: populated, message: "Status updated" });
}

// Live tracking — driver's real-time position + ETA to delivery
async function getLiveTracking(req, res) {
  const load = await Load.findById(req.params.id)
    .populate("assignedDriver", "name phone currentLocation currentLocationGeo locationUpdatedAt truckTypes rating")
    .populate("postedBy", "name phone companyName");
  if (!load) throw createError(404, "Load not found");

  const isOwner = req.user && load.postedBy?._id?.toString() === req.user._id.toString();
  const isAssignedDriver =
    req.user &&
    isDriverLikeRole(req.user.role) &&
    req.user.driverProfile &&
    load.assignedDriver?._id?.toString() === req.user.driverProfile.toString();
  const isAdmin = req.user && req.user.role === "admin";

  if (!isOwner && !isAssignedDriver && !isAdmin) {
    throw createError(403, "Not authorized to view live tracking");
  }

  const driver = load.assignedDriver;
  let eta = null;

  // Compute remaining ETA from driver's current position to delivery
  if (driver?.currentLocationGeo?.lat && load.deliveryGeo?.lat) {
    const route = await getDirections(driver.currentLocationGeo, load.deliveryGeo);
    if (route) {
      eta = {
        distanceKm: parseFloat(route.distanceKm.toFixed(1)),
        durationMin: Math.round(route.durationMin),
        arrivalEstimate: new Date(Date.now() + route.durationMin * 60 * 1000).toISOString()
      };
    }
  }

  const statusProgress = {
    open: 0,
    assigned: 25,
    in_transit: 60,
    delivered: 100,
    cancelled: 0
  };

  return res.json({
    success: true,
    data: {
      loadId: load._id,
      trackingId: load.trackingId,
      status: load.status,
      progress: statusProgress[load.status] ?? 0,
      pickup: {
        address: load.pickupLocation || load.pickupCity,
        geo: load.pickupGeo ?? null
      },
      delivery: {
        address: load.deliveryLocation || load.deliveryCity,
        geo: load.deliveryGeo ?? null
      },
      driver: driver
        ? {
            name: driver.name,
            phone: driver.phone,
            currentLocation: driver.currentLocation,
            currentLocationGeo: driver.currentLocationGeo ?? null,
            locationUpdatedAt: driver.locationUpdatedAt ?? null,
            links: {
              call: driver.phone ? `tel:${driver.phone}` : null,
              whatsapp: driver.phone
                ? `https://wa.me/${driver.phone.replace(/\D/g, "").replace(/^0/, "256")}`
                : null
            }
          }
        : null,
      eta,
      statusHistory: load.statusHistory ?? []
    }
  });
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
  getAvailableLoads,
  getLoadContact,
  getLiveTracking,
  acceptLoad,
  updateStatus
};
