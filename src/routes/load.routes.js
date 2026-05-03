const express = require("express");
const {
  createLoad,
  getLoads,
  getLoad,
  updateLoad,
  deleteLoad,
  assignDriver,
  getLoadMatches,
  getAvailableLoads,
  getLoadContact,
  getLiveTracking,
  acceptLoad,
  updateStatus,
  trackLoadByTrackingId
} = require("../controllers/load.controller");
const { auth, requireRole } = require("../middleware/auth");

const router = express.Router();

// Must be before /:id routes to avoid "available" being treated as an id
router.get("/available", auth, requireRole("driver"), getAvailableLoads);

router
  .route("/")
  .get(auth, getLoads)
  .post(auth, requireRole("trader", "admin"), createLoad);

router.get("/track/:trackingId", trackLoadByTrackingId);

router
  .route("/:id")
  .get(auth, getLoad)
  .patch(auth, updateLoad)
  .delete(auth, deleteLoad);

router.get("/:id/matches", auth, getLoadMatches);
router.get("/:id/contact", auth, getLoadContact);
router.get("/:id/live", auth, getLiveTracking);
router.post("/:id/assign", auth, requireRole("admin"), assignDriver);
router.post("/:id/accept", auth, requireRole("driver"), acceptLoad);
router.post("/:id/status", auth, updateStatus);

module.exports = router;
