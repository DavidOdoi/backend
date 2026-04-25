const express = require("express");
const {
  createLoad,
  getLoads,
  getLoad,
  updateLoad,
  deleteLoad,
  assignDriver,
  getLoadMatches,
  acceptLoad,
  updateStatus,
  contactCustomer
} = require("../controllers/load.controller");
const { auth, requireRole } = require("../middleware/auth");

const router = express.Router();

router
  .route("/")
  .get(auth, getLoads)
  .post(auth, requireRole("trader", "admin"), createLoad);

router
  .route("/:id")
  .get(auth, getLoad)
  .patch(auth, updateLoad)
  .delete(auth, deleteLoad);

router.get("/:id/matches", auth, getLoadMatches);
router.post("/:id/assign", auth, requireRole("admin"), assignDriver);
router.post("/:id/accept", auth, requireRole("driver"), acceptLoad);
router.post("/:id/status", auth, updateStatus);
router.post("/:id/contact", auth, requireRole("driver"), contactCustomer);

module.exports = router;
