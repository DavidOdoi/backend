require("dotenv").config();
const { createApp } = require("../src/app");
const { connectDB } = require("../src/config/db");

const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;

const app = createApp();

// Lazy connection — created once, reused on warm invocations
let connectionPromise = null;

function getConnection() {
  if (!connectionPromise) {
    connectionPromise = connectDB(MONGO_URI);
  }
  return connectionPromise;
}

module.exports = async (req, res) => {
  // Guard: catch missing env vars at request time so we return a proper response
  // instead of crashing the function at module load
  if (!process.env.JWT_SECRET) {
    console.error("FATAL: JWT_SECRET is not set in Vercel environment variables");
    return res.status(500).json({ success: false, message: "Server misconfiguration" });
  }

  if (!MONGO_URI) {
    console.error("FATAL: MONGO_URI is not set in Vercel environment variables");
    return res.status(500).json({ success: false, message: "Server misconfiguration" });
  }

  try {
    await getConnection();
  } catch (err) {
    console.error("DB connection failed:", err.message);
    return res.status(503).json({ success: false, message: "Database unavailable. Please try again shortly." });
  }

  return app(req, res);
};
