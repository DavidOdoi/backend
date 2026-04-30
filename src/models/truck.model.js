const mongoose = require("mongoose");

const truckSchema = new mongoose.Schema(
  {
    plateNumber: { type: String, required: true, trim: true, uppercase: true },
    type: { type: String, required: true, trim: true },
    capacity: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["available", "in_use", "maintenance", "offline"],
      default: "available"
    },
    currentLocation: { type: String, trim: true },
    currentLocationGeo: {
      lat: { type: Number },
      lng: { type: Number }
    },
    currentShipment: { type: mongoose.Schema.Types.ObjectId, ref: "Load" },
    assignedDriver: { type: mongoose.Schema.Types.ObjectId, ref: "Driver" },
    insuranceExpiry: { type: Date },
    serviceDueDate: { type: Date },
    notes: { type: String, trim: true },
    lastMovementAt: { type: Date }
  },
  { timestamps: true }
);

truckSchema.index({ plateNumber: 1 }, { unique: true });
truckSchema.index({ status: 1 });

const Truck = mongoose.model("Truck", truckSchema);

module.exports = { Truck };
