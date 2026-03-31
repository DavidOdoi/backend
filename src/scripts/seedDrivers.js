const path = require("path");
const dotenv = require("dotenv");
const { connectDB } = require("../config/db");
const { Driver } = require("../models/driver.model");

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function seedDrivers() {
  if (!process.env.MONGO_URI && !process.env.MONGODB_URI) {
    throw new Error("MONGO_URI or MONGODB_URI is required in .env");
  }

  const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
  await connectDB(uri);

  const existing = await Driver.countDocuments();
  if (existing > 0) {
    console.log(`Skipping seed; ${existing} drivers already exist`);
    return;
  }

  const drivers = [
    {
      name: "John Kamau",
      phone: "+254700000001",
      email: "john.kamau@example.com",
      truckTypes: ["flatbed", "box"],
      maxWeight: 25,
      cargoTypes: ["general", "construction"],
      specialCapabilities: ["fragile"],
      languages: ["en", "sw"],
      currentLocation: "Nairobi",
      homeBase: "Nairobi",
      preferredRoutes: [{ from: "Nairobi", to: "Mombasa" }],
      pricePerKm: 120,
      rating: 4.8,
      experienceYears: 6,
      verified: true,
      availability: { status: "available" }
    },
    {
      name: "Peter Wanjiru",
      phone: "+254700000002",
      email: "peter.wanjiru@example.com",
      truckTypes: ["container"],
      maxWeight: 30,
      cargoTypes: ["container", "general"],
      specialCapabilities: ["refrigerated"],
      languages: ["en", "sw"],
      currentLocation: "Mombasa",
      homeBase: "Mombasa",
      preferredRoutes: [{ from: "Mombasa", to: "Nairobi" }, { from: "Mombasa", to: "Kampala" }],
      pricePerKm: 150,
      rating: 4.7,
      experienceYears: 5,
      verified: true,
      availability: { status: "available" }
    },
    {
      name: "Samuel Kibet",
      phone: "+254700000003",
      email: "samuel.kibet@example.com",
      truckTypes: ["refrigerated", "tanker"],
      maxWeight: 22,
      cargoTypes: ["perishable", "hazardous"],
      specialCapabilities: ["refrigerated", "hazardous"],
      languages: ["en", "sw"],
      currentLocation: "Kampala",
      homeBase: "Kampala",
      preferredRoutes: [{ from: "Kampala", to: "Dar es Salaam" }],
      pricePerKm: 140,
      rating: 4.6,
      experienceYears: 4,
      verified: true,
      availability: { status: "available" }
    }
  ];

  await Driver.insertMany(drivers);
  console.log(`Seeded ${drivers.length} drivers.`);
}

seedDrivers()
  .then(() => {
    console.log("Done");
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
