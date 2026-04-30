const mongoose = require("mongoose");

const STATUS_HISTORY_VALUES = ["open", "assigned", "in_transit", "delivered", "cancelled"];

function createTrackingId() {
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
  const timePart = Date.now().toString(36).slice(-4).toUpperCase();
  return `TRK-${timePart}-${randomPart}`;
}

const statusHistorySchema = new mongoose.Schema(
  {
    status: {
      type: String,
      enum: STATUS_HISTORY_VALUES,
      required: true
    },
    note: { type: String, trim: true },
    location: { type: String, trim: true },
    changedByRole: { type: String, trim: true },
    timestamp: { type: Date, default: Date.now }
  },
  { _id: false }
);

const loadSchema = new mongoose.Schema(
  {
    trackingId: { type: String, unique: true, index: true },
    pickupLocation: { type: String, required: true, trim: true },
    deliveryLocation: { type: String, required: true, trim: true },
    cargoType: { type: String, required: true, trim: true },
    weight: { type: Number, required: true, min: 0 },

    pickupGeo: {
      lat: { type: Number },
      lng: { type: Number }
    },
    deliveryGeo: {
      lat: { type: Number },
      lng: { type: Number }
    },

    price: { type: Number, min: 0 },
    pickupDate: { type: Date },
    contactName: { type: String, trim: true },
    contactPhone: { type: String, trim: true },

    // Extended fields used by the richer PostLoad flow
    loadType: { type: String, trim: true },
    length: { type: Number, min: 0 },
    width: { type: Number, min: 0 },
    height: { type: Number, min: 0 },
    quantity: { type: Number, min: 0 },
    description: { type: String, trim: true },
    pickupCity: { type: String, trim: true },
    pickupTime: { type: String, trim: true },
    deliveryCity: { type: String, trim: true },
    deliveryDate: { type: Date },
    deliveryTime: { type: String, trim: true },
    deliveryContact: { type: String, trim: true },
    deliveryPhone: { type: String, trim: true },
    truckType: { type: String, trim: true },
    specialRequirements: [{ type: String, trim: true }],
    budget: { type: Number, min: 0 },
    notes: { type: String, trim: true },

    assignedDriver: { type: mongoose.Schema.Types.ObjectId, ref: "Driver" },
    postedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending"
    },
    paymentAmount: { type: Number, min: 0 },
    paymentRef: { type: String, trim: true },

    status: {
      type: String,
      enum: ["open", "assigned", "in_transit", "delivered", "cancelled"],
      default: "open"
    },
    statusHistory: [statusHistorySchema]
  },
  { timestamps: true }
);

loadSchema.index({ pickupLocation: "text", deliveryLocation: "text", cargoType: "text" });
loadSchema.index({ status: 1, pickupDate: -1 });

loadSchema.pre("validate", function preValidate(next) {
  if (!this.trackingId) {
    this.trackingId = createTrackingId();
  }
  next();
});

loadSchema.pre("save", function preSave(next) {
  if (this.isNew && (!Array.isArray(this.statusHistory) || this.statusHistory.length === 0)) {
    this.statusHistory = [
      {
        status: this.status || "open",
        note: "Shipment created",
        location: this.pickupCity || this.pickupLocation
      }
    ];
  }
  next();
});

const Load = mongoose.model("Load", loadSchema);

module.exports = { Load };
