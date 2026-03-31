const express = require("express");
const {
  createDriver,
  getDrivers,
  getDriver,
  updateDriver,
  deleteDriver
} = require("../controllers/driver.controller");
const { auth, requireRole } = require("../middleware/auth");

const router = express.Router();

router
  .route("/")
  .get(getDrivers)
  .post(auth, requireRole("driver", "admin"), createDriver);

router
  .route("/:id")
  .get(getDriver)
  .patch(auth, requireRole("driver", "admin"), updateDriver)
  .delete(auth, requireRole("admin"), deleteDriver);

module.exports = router;
