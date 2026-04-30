const express = require("express");
const {
  createTruck,
  getTrucks,
  getTruck,
  updateTruck,
  deleteTruck,
  assignDriverToTruck,
  unassignDriverFromTruck,
  simulateTruckMovement
} = require("../controllers/truck.controller");
const { auth, requireRole } = require("../middleware/auth");

const router = express.Router();

router
  .route("/")
  .get(auth, getTrucks)
  .post(auth, requireRole("admin", "staff"), createTruck);

router
  .route("/:id")
  .get(auth, getTruck)
  .patch(auth, requireRole("admin", "staff"), updateTruck)
  .delete(auth, requireRole("admin"), deleteTruck);

router.post("/:id/assign-driver", auth, requireRole("admin", "staff"), assignDriverToTruck);
router.post("/:id/unassign-driver", auth, requireRole("admin", "staff"), unassignDriverFromTruck);
router.post("/:id/movement", auth, requireRole("admin", "staff", "driver"), simulateTruckMovement);

module.exports = router;
