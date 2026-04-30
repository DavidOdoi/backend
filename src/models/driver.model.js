const mongoose = require("mongoose");

const routeSchema = new mongoose.Schema(
  {
    from: { type: String, trim: true },
    fromGeo: { lat: { type: Number }, lng: { type: Number } },
    to: { type: String, trim: true },
    toGeo: { lat: { type: Number }, lng: { type: Number } }
  },
  { _id: false }
);

const driverSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true },

    truckTypes: [{ type: String, trim: true }],
    maxWeight: { type: Number, required: true, min: 0 },
    cargoTypes: [{ type: String, trim: true }],
    specialCapabilities: [{ type: String, trim: true }],
    languages: [{ type: String, trim: true }],
    assignedTruck: { type: mongoose.Schema.Types.ObjectId, ref: "Truck" },

    currentLocation: { type: String, required: true, trim: true },
    currentLocationGeo: {
      lat: { type: Number },
      lng: { type: Number }
    },
    locationUpdatedAt: { type: Date },
    homeBase: { type: String, trim: true },
    preferredRoutes: [routeSchema],

    pricePerKm: { type: Number, min: 0, required: true },
    rating: { type: Number, min: 0, max: 5, default: 4.5 },
    experienceYears: { type: Number, min: 0 },
    verified: { type: Boolean, default: false },

    totalTrips: { type: Number, default: 0, min: 0 },
    completedTrips: { type: Number, default: 0, min: 0 },
    cancelledTrips: { type: Number, default: 0, min: 0 },

    availability: {
      status: {
        type: String,
        enum: ["available", "busy", "off"],
        default: "available"
      },
      from: { type: Date },
      to: { type: Date }
    }
  },
  { timestamps: true }
);

const Driver = mongoose.model("Driver", driverSchema);

module.exports = { Driver };
