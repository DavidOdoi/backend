const mongoose = require("mongoose");

const loadSchema = new mongoose.Schema(
  {
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

    status: {
      type: String,
      enum: ["open", "assigned", "in_transit", "delivered", "cancelled"],
      default: "open"
    }
  },
  { timestamps: true }
);

loadSchema.index({ pickupLocation: "text", deliveryLocation: "text", cargoType: "text" });
loadSchema.index({ status: 1, pickupDate: -1 });

const Load = mongoose.model("Load", loadSchema);

module.exports = { Load };
