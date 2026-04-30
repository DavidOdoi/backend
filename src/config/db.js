const mongoose = require("mongoose");

async function connectDB(uri) {
  if (!uri) {
    throw new Error("MONGO_URI is missing");
  }

  const MAX_RETRIES = 3;
  let retryCount = 0;

  while (retryCount < MAX_RETRIES) {
    try {
      console.log(`Attempting to connect to MongoDB (attempt ${retryCount + 1}/${MAX_RETRIES})...`);
      
      await mongoose.connect(uri, {
        autoIndex: true,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        retryWrites: true,
        connectTimeoutMS: 10000,
      });

      console.log("✅ Connected to MongoDB successfully");
      return;
    } catch (error) {
      retryCount++;
      console.error(`❌ Connection attempt ${retryCount} failed:`, error.message);
      
      if (retryCount < MAX_RETRIES) {
        console.log(`Retrying in 2 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        throw new Error(`Failed to connect to MongoDB after ${MAX_RETRIES} attempts. Check:\n` +
          `1. MongoDB URI is correct in .env\n` +
          `2. Your IP is whitelisted in MongoDB Atlas\n` +
          `3. MongoDB cluster is running\n` +
          `4. Network connectivity is available`);
      }
    }
  }
}

module.exports = { connectDB };
