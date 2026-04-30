const { Truck } = require("../models/truck.model");
const { Driver } = require("../models/driver.model");
const { Load } = require("../models/load.model");
const {
  validateCreateTruck,
  validateUpdateTruck,
  validateAssignDriver,
  validateMovement
} = require("../validators/truck.validator");

const createError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

const isDriverLikeRole = (role) => role === "driver" || role === "staff";

async function createTruck(req, res) {
  const payload = validateCreateTruck(req.body);
  const truck = await Truck.create(payload);

  return res.status(201).json({
    success: true,
    data: truck,
    message: "Truck created"
  });
}

async function getTrucks(req, res) {
  const query = {};
  if (req.query.status) {
    query.status = req.query.status;
  }
  if (req.query.assigned === "true") {
    query.assignedDriver = { $ne: null };
  }
  if (req.query.assigned === "false") {
    query.assignedDriver = null;
  }

  const trucks = await Truck.find(query)
    .populate("assignedDriver", "name phone currentLocation availability")
    .populate("currentShipment", "trackingId status pickupCity deliveryCity pickupLocation deliveryLocation")
    .sort({ createdAt: -1 });

  return res.json({
    success: true,
    data: trucks
  });
}

async function getTruck(req, res) {
  const truck = await Truck.findById(req.params.id)
    .populate("assignedDriver", "name phone currentLocation availability")
    .populate("currentShipment", "trackingId status pickupCity deliveryCity pickupLocation deliveryLocation");
  if (!truck) {
    throw createError(404, "Truck not found");
  }

  return res.json({
    success: true,
    data: truck
  });
}

async function updateTruck(req, res) {
  const updates = validateUpdateTruck(req.body);
  const truck = await Truck.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true
  })
    .populate("assignedDriver", "name phone currentLocation availability")
    .populate("currentShipment", "trackingId status");

  if (!truck) {
    throw createError(404, "Truck not found");
  }

  return res.json({
    success: true,
    data: truck,
    message: "Truck updated"
  });
}

async function deleteTruck(req, res) {
  const truck = await Truck.findById(req.params.id);
  if (!truck) {
    throw createError(404, "Truck not found");
  }

  if (truck.assignedDriver) {
    await Driver.findByIdAndUpdate(truck.assignedDriver, { $unset: { assignedTruck: 1 } });
  }

  await truck.deleteOne();

  return res.json({
    success: true,
    data: truck,
    message: "Truck deleted"
  });
}

async function assignDriverToTruck(req, res) {
  const { driverId } = validateAssignDriver(req.body);
  const truck = await Truck.findById(req.params.id);
  if (!truck) throw createError(404, "Truck not found");

  const driver = await Driver.findById(driverId);
  if (!driver) throw createError(404, "Driver not found");

  if (driver.assignedTruck && driver.assignedTruck.toString() !== truck._id.toString()) {
    await Truck.findByIdAndUpdate(driver.assignedTruck, { $unset: { assignedDriver: 1 } });
  }

  if (truck.assignedDriver && truck.assignedDriver.toString() !== driver._id.toString()) {
    await Driver.findByIdAndUpdate(truck.assignedDriver, { $unset: { assignedTruck: 1 } });
  }

  truck.assignedDriver = driver._id;
  await truck.save();

  driver.assignedTruck = truck._id;
  await driver.save();

  const populated = await Truck.findById(truck._id)
    .populate("assignedDriver", "name phone currentLocation availability")
    .populate("currentShipment", "trackingId status");

  return res.json({
    success: true,
    data: populated,
    message: "Driver assigned to truck"
  });
}

async function unassignDriverFromTruck(req, res) {
  const truck = await Truck.findById(req.params.id);
  if (!truck) throw createError(404, "Truck not found");

  if (truck.assignedDriver) {
    await Driver.findByIdAndUpdate(truck.assignedDriver, { $unset: { assignedTruck: 1 } });
  }

  truck.assignedDriver = undefined;
  truck.currentShipment = undefined;
  truck.status = "available";
  await truck.save();

  return res.json({
    success: true,
    data: truck,
    message: "Driver unassigned from truck"
  });
}

async function simulateTruckMovement(req, res) {
  const payload = validateMovement(req.body);
  const truck = await Truck.findById(req.params.id);
  if (!truck) throw createError(404, "Truck not found");

  const isAdmin = req.user?.role === "admin";
  const isAssignedDriver =
    isDriverLikeRole(req.user?.role) &&
    req.user?.driverProfile &&
    truck.assignedDriver &&
    req.user.driverProfile.toString() === truck.assignedDriver.toString();

  if (!isAdmin && !isAssignedDriver) {
    throw createError(403, "Not allowed to update truck movement");
  }

  truck.currentLocation = payload.location;
  truck.currentLocationGeo =
    typeof payload.lat === "number" && typeof payload.lng === "number"
      ? { lat: payload.lat, lng: payload.lng }
      : truck.currentLocationGeo;
  truck.lastMovementAt = new Date();

  if (payload.shipmentId) {
    const load = await Load.findById(payload.shipmentId);
    if (!load) throw createError(404, "Shipment not found");

    truck.currentShipment = load._id;
    if (payload.status) {
      load.status = payload.status;
    }
    if (!Array.isArray(load.statusHistory)) {
      load.statusHistory = [];
    }
    load.statusHistory.push({
      status: load.status,
      note: payload.note || "Truck movement update",
      location: payload.location,
      changedByRole: req.user?.role || "system",
      timestamp: new Date()
    });
    await load.save();

    if (payload.status === "in_transit") {
      truck.status = "in_use";
    } else if (payload.status === "delivered") {
      truck.status = "available";
      truck.currentShipment = undefined;
    }
  }

  await truck.save();

  if (truck.assignedDriver) {
    await Driver.findByIdAndUpdate(truck.assignedDriver, {
      currentLocation: payload.location,
      currentLocationGeo:
        typeof payload.lat === "number" && typeof payload.lng === "number"
          ? { lat: payload.lat, lng: payload.lng }
          : undefined,
      locationUpdatedAt: new Date()
    });
  }

  const updated = await Truck.findById(truck._id)
    .populate("assignedDriver", "name phone currentLocation availability")
    .populate("currentShipment", "trackingId status pickupCity deliveryCity");

  return res.json({
    success: true,
    data: updated,
    message: "Truck movement updated"
  });
}

module.exports = {
  createTruck,
  getTrucks,
  getTruck,
  updateTruck,
  deleteTruck,
  assignDriverToTruck,
  unassignDriverFromTruck,
  simulateTruckMovement
};
