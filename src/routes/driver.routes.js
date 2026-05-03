const express = require("express");
const {
  createDriver,
  getDrivers,
  getDriver,
  updateDriver,
  deleteDriver,
  updateMyLocation,
  updateMyAvailability,
  getMyLoads,
  searchDrivers
} = require("../controllers/driver.controller");
const { auth, requireRole } = require("../middleware/auth");

const router = express.Router();

// Must be before /:id to avoid "me", "search" being treated as IDs
router.get("/search", searchDrivers);
router.get("/me/loads", auth, requireRole("driver"), getMyLoads);
router.patch("/me/location", auth, requireRole("driver"), updateMyLocation);
router.patch("/me/availability", auth, requireRole("driver"), updateMyAvailability);

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
