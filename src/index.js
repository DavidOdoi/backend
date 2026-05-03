const dotenv = require("dotenv");
dotenv.config();

const http = require("http");
const { createApp } = require("./app");
const { connectDB } = require("./config/db");
const { init: initSocket } = require("./services/socket.service");

const PORT = process.env.PORT || 5001;
const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
const JWT_SECRET = process.env.JWT_SECRET;

const ALLOWED_ORIGINS = [
  process.env.ALLOWED_ORIGIN,
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:5176",
  "http://localhost:3000"
].filter(Boolean);

async function start() {
  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is missing");
  }
  await connectDB(MONGO_URI);

  const app = createApp();
  const server = http.createServer(app);

  initSocket(server, ALLOWED_ORIGINS);

  server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

start().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});
