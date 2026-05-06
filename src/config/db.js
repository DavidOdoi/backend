const mongoose = require("mongoose");

async function connectDB(uri) {
  if (!uri) {
    throw new Error("MONGO_URI is missing");
  }

  // Reuse existing connection — critical for serverless (Vercel) warm invocations
  if (mongoose.connection.readyState === 1) {
    return;
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

      console.log("Connected to MongoDB successfully");
      return;
    } catch (error) {
      retryCount++;
      console.error(`MongoDB connection attempt ${retryCount} failed:`, error.message);

      if (retryCount < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        throw new Error(
          `Failed to connect to MongoDB after ${MAX_RETRIES} attempts.\n` +
          `Check: MONGO_URI is correct, your IP is whitelisted in Atlas, and the cluster is running.`
        );
      }
    }
  }
}

module.exports = { connectDB };
