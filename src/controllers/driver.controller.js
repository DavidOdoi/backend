const { Driver } = require("../models/driver.model");
const { validateCreateDriver, validateUpdateDriver } = require("../validators/driver.validator");
const { User } = require("../models/user.model");
const { geocodeLocation } = require("../services/distance.service");

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

  // If created by an authenticated driver user without profile, link it
  if (req.user && req.user.role === "driver") {
    await User.findByIdAndUpdate(req.user._id, { driverProfile: driver._id });
  }

  res.status(201).json({
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

  const drivers = await Driver.find(query).sort({ createdAt: -1 });
  res.json({
    success: true,
    data: drivers
  });
}

async function getDriver(req, res) {
  const driver = await Driver.findById(req.params.id);
  if (!driver) {
    throw createError(404, "Driver not found");
  }

  res.json({
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
  });

  if (!driver) {
    throw createError(404, "Driver not found");
  }

  res.json({
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

  res.json({
    success: true,
    data: driver,
    message: "Driver deleted"
  });
}

module.exports = {
  createDriver,
  getDrivers,
  getDriver,
  updateDriver,
  deleteDriver
};
