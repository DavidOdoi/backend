require("express-async-errors");
const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");

const loadRoutes = require("./routes/load.routes");
const driverRoutes = require("./routes/driver.routes");
const truckRoutes = require("./routes/truck.routes");
const authRoutes = require("./routes/auth.routes");
const paymentRoutes = require("./routes/payment.routes");
const userRoutes = require("./routes/user.routes");
const dashboardRoutes = require("./routes/dashboard.routes");
const notificationRoutes = require("./routes/notification.routes");
const { notFound, errorHandler } = require("./middleware/errorHandler");

function createApp() {
  const app = express();

  // FRONTEND_URL supports comma-separated values for multiple origins
  const frontendOrigins = (process.env.FRONTEND_URL || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);

  const allowedOrigins = [
    ...frontendOrigins,
    process.env.ALLOWED_ORIGIN,
<<<<<<< HEAD
    "https://elogistica.vercel.app",
=======
>>>>>>> 4ec62cd1b70c4d4522d023f705d701f45162bf96
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
    "http://localhost:5176",
    "http://localhost:3000",
  ].filter(Boolean);

  app.use(
    cors({
      origin: allowedOrigins,
      methods: ["GET", "POST", "PATCH", "DELETE", "PUT"],
      allowedHeaders: ["Content-Type", "Authorization"],
      credentials: true,
    })
  );

  app.use(helmet());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  if (process.env.NODE_ENV !== "test") {
    app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
  }

  app.get("/health", (req, res) => {
    res.json({ success: true, message: "OK" });
  });

  app.use("/api/v1/auth", authRoutes);
  app.use("/api/v1/loads", loadRoutes);
  app.use("/api/v1/drivers", driverRoutes);
  app.use("/api/v1/trucks", truckRoutes);
  app.use("/api/v1/payments", paymentRoutes);
  app.use("/api/v1/users", userRoutes);
  app.use("/api/v1/dashboard", dashboardRoutes);
  app.use("/api/v1/notifications", notificationRoutes);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = { createApp };
