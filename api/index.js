require("dotenv").config();
const { createApp } = require("../src/app");
const { connectDB } = require("../src/config/db");

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is missing");
}

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

const app = createApp();

// Initiate DB connection at module load.
// Mongoose caches the connection — warm serverless invocations reuse it.
const whenReady = connectDB(MONGO_URI);

module.exports = async (req, res) => {
  await whenReady;
  return app(req, res);
};
