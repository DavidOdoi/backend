const { Driver } = require("../models/driver.model");
const { Load } = require("../models/load.model");
const { validateCreateDriver, validateUpdateDriver } = require("../validators/driver.validator");
const { User } = require("../models/user.model");
const { geocodeLocation } = require("../services/distance.service");
const { emitToLoad } = require("../services/socket.service");

const createError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

async function geocodeRoutes(routes) {
  if (!Array.isArray(routes) || routes.length === 0) return routes;
  return Promise.all(
    routes.map(async (route) => {
      const enriched = { ...route };
      if (route.from) {
        const geo = await geocodeLocation(route.from);
        if (geo) enriched.fromGeo = geo;
      }
      if (route.to) {
        const geo = await geocodeLocation(route.to);
        if (geo) enriched.toGeo = geo;
      }
      return enriched;
    })
  );
}

async function createDriver(req, res) {
  const payload = validateCreateDriver(req.body);
  if (payload.currentLocation) {
    const geo = await geocodeLocation(payload.currentLocation);
    if (geo) payload.currentLocationGeo = geo;
  }
  if (payload.preferredRoutes) {
    payload.preferredRoutes = await geocodeRoutes(payload.preferredRoutes);
  }
  const driver = await Driver.create(payload);

  if (req.user && req.user.role === "driver") {
    await User.findByIdAndUpdate(req.user._id, { driverProfile: driver._id });
  }

  return res.status(201).json({
    success: true,
    data: driver,
    message: "Driver created"
  });
}

async function getDrivers(req, res) {
  const { status } = req.query;
  const query = {};
  if (status) {
    query["availability.status"] = status;
  }

  const drivers = await Driver.find(query)
    .populate("assignedTruck", "plateNumber type status")
    .sort({ createdAt: -1 });
  return res.json({
    success: true,
    data: drivers
  });
}

async function getDriver(req, res) {
  const driver = await Driver.findById(req.params.id).populate("assignedTruck", "plateNumber type status");
  if (!driver) {
    throw createError(404, "Driver not found");
  }

  return res.json({
    success: true,
    data: driver
  });
}

async function updateDriver(req, res) {
  const updates = validateUpdateDriver(req.body);
  if (updates.currentLocation) {
    const geo = await geocodeLocation(updates.currentLocation);
    if (geo) updates.currentLocationGeo = geo;
  }
  if (updates.preferredRoutes) {
    updates.preferredRoutes = await geocodeRoutes(updates.preferredRoutes);
  }
  const driver = await Driver.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true
  }).populate("assignedTruck", "plateNumber type status");

  if (!driver) {
    throw createError(404, "Driver not found");
  }

  return res.json({
    success: true,
    data: driver,
    message: "Driver updated"
  });
}

async function deleteDriver(req, res) {
  const driver = await Driver.findByIdAndDelete(req.params.id);
  if (!driver) {
    throw createError(404, "Driver not found");
  }

  return res.json({
    success: true,
    data: driver,
    message: "Driver deleted"
  });
}

// Driver pushes live GPS coordinates while on a trip
async function updateMyLocation(req, res) {
  if (!req.user?.driverProfile) throw createError(403, "Driver account required");

  const { lat, lng, location } = req.body;
  if (typeof lat !== "number" || typeof lng !== "number") {
    throw createError(400, "lat and lng (numbers) are required");
  }

  const updates = {
    currentLocationGeo: { lat, lng },
    locationUpdatedAt: new Date()
  };
  if (location && typeof location === "string") {
    updates.currentLocation = location.trim();
  }

  const driver = await Driver.findByIdAndUpdate(req.user.driverProfile, updates, { new: true });
  if (!driver) throw createError(404, "Driver profile not found");

  // Broadcast to any load rooms where this driver is active
  const activeLoad = await Load.findOne({
    assignedDriver: req.user.driverProfile,
    status: { $in: ["assigned", "in_transit"] }
  }).select("_id");

  if (activeLoad) {
    emitToLoad(activeLoad._id.toString(), "driver:location", {
      loadId: activeLoad._id,
      lat,
      lng,
      heading: req.body.heading ?? null,
      speed: req.body.speed ?? null,
      timestamp: new Date().toISOString()
    });
  }

  return res.json({
    success: true,
    data: {
      currentLocationGeo: driver.currentLocationGeo,
      currentLocation: driver.currentLocation,
      locationUpdatedAt: driver.locationUpdatedAt,
      broadcastedToLoad: activeLoad?._id ?? null
    }
  });
}

// Toggle driver availability
async function updateMyAvailability(req, res) {
  if (!req.user?.driverProfile) throw createError(403, "Driver account required");

  const { status, from, to } = req.body;
  const validStatuses = ["available", "busy", "off"];
  if (!validStatuses.includes(status)) {
    throw createError(400, `status must be one of: ${validStatuses.join(", ")}`);
  }

  const availabilityUpdate = { "availability.status": status };
  if (from) availabilityUpdate["availability.from"] = new Date(from);
  if (to) availabilityUpdate["availability.to"] = new Date(to);

  const driver = await Driver.findByIdAndUpdate(
    req.user.driverProfile,
    availabilityUpdate,
    { new: true }
  );
  if (!driver) throw createError(404, "Driver profile not found");

  return res.json({
    success: true,
    data: { availability: driver.availability },
    message: `You are now ${status}`
  });
}

// Driver's own loads — active and history
async function getMyLoads(req, res) {
  if (!req.user?.driverProfile) throw createError(403, "Driver account required");

  const filter = { assignedDriver: req.user.driverProfile };
  if (req.query.status) filter.status = req.query.status;

  const loads = await Load.find(filter)
    .populate("postedBy", "name phone email companyName")
    .sort({ createdAt: -1 });

  // Attach contact links to each trader
  const data = loads.map((load) => {
    const trader = load.postedBy;
    const phone = trader?.phone;
    const email = trader?.email;
    const links = {};
    if (phone) {
      const digits = phone.replace(/\D/g, "");
      const e164 = digits.startsWith("0") && digits.length === 10
        ? `+256${digits.slice(1)}`
        : `+${digits}`;
      links.call = `tel:${e164}`;
      links.sms = `sms:${e164}`;
      links.whatsapp = `https://wa.me/${e164.replace("+", "")}`;
    }
    if (email) links.email = `mailto:${email}`;

    return {
      ...load.toObject(),
      traderContact: trader ? { name: trader.name, company: trader.companyName, phone, email, links } : null
    };
  });

  return res.json({ success: true, data });
}

// Search drivers by name, location, truckType, availability
async function searchDrivers(req, res) {
  const { q, truckType, location, availability, limit = 20 } = req.query;

  const filter = {};

  if (availability) {
    filter["availability.status"] = availability;
  }

  if (truckType) {
    filter.truckTypes = { $in: [truckType] };
  }

  if (location) {
    filter.currentLocation = { $regex: location, $options: "i" };
  }

  let drivers;

  if (q) {
    // Text-style search across name and currentLocation
    drivers = await Driver.find({
      ...filter,
      $or: [
        { name: { $regex: q, $options: "i" } },
        { currentLocation: { $regex: q, $options: "i" } },
        { homeBase: { $regex: q, $options: "i" } },
        { truckTypes: { $in: [new RegExp(q, "i")] } }
      ]
    })
      .select("name phone truckTypes currentLocation rating availability verified experienceYears totalTrips completedTrips")
      .limit(Math.min(Number(limit), 50))
      .sort({ rating: -1 });
  } else {
    drivers = await Driver.find(filter)
      .select("name phone truckTypes currentLocation rating availability verified experienceYears totalTrips completedTrips")
      .limit(Math.min(Number(limit), 50))
      .sort({ rating: -1 });
  }

  return res.json({ success: true, data: drivers });
}

module.exports = {
  createDriver,
  getDrivers,
  getDriver,
  updateDriver,
  deleteDriver,
  updateMyLocation,
  updateMyAvailability,
  getMyLoads,
  searchDrivers
};
