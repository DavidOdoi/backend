const express = require("express");
const {
  createPayment,
  getPayments,
  getPayment,
  updatePaymentStatus,
  simulatePayment,
  getLatestShipmentPayment
} = require("../controllers/payment.controller");
const { auth, requireRole } = require("../middleware/auth");

const router = express.Router();

router
  .route("/")
  .get(auth, getPayments)
  .post(auth, requireRole("trader", "customer", "admin", "staff"), createPayment);

router.get("/shipment/:shipmentId/latest", auth, getLatestShipmentPayment);

router
  .route("/:id")
  .get(auth, getPayment)
  .patch(auth, updatePaymentStatus);

router.post("/:id/simulate", auth, requireRole("admin", "staff"), simulatePayment);

module.exports = router;
