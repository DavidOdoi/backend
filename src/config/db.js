const mongoose = require("mongoose");

async function connectDB(uri) {
  if (!uri) {
    throw new Error("MONGO_URI is missing");
  }

  await mongoose.connect(uri, {
    autoIndex: true,
    serverSelectionTimeoutMS: 5000
  });

  console.log("Connected to MongoDB");
}

module.exports = { connectDB };
