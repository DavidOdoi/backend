const { Payment } = require("../models/payment.model");
const { Load } = require("../models/load.model");
const {
  validateCreatePayment,
  validatePaymentStatus,
  validateSimulatePayment
} = require("../validators/payment.validator");

const createError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

const isPrivilegedRole = (role) => role === "admin" || role === "staff";

function generateTxnId() {
  return `PAY-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

async function syncLoadPayment(loadId, payment) {
  if (!loadId || !payment) return;
  await Load.findByIdAndUpdate(loadId, {
    paymentStatus: payment.status,
    paymentAmount: payment.amount,
    paymentRef: payment.transactionId || payment.externalRef || payment._id.toString()
  });
}

async function createPayment(req, res) {
  const payload = validateCreatePayment(req.body);
  const load = await Load.findById(payload.shipmentId);
  if (!load) throw createError(404, "Shipment not found");

  const isOwner = load.postedBy && load.postedBy.toString() === req.user._id.toString();
  if (!isOwner && !isPrivilegedRole(req.user.role)) {
    throw createError(403, "Not allowed to pay for this shipment");
  }

  const amount = typeof payload.amount === "number" ? payload.amount : load.price || load.budget || 0;
  const payment = await Payment.create({
    shipment: load._id,
    payer: req.user._id,
    amount,
    currency: payload.currency || "UGX",
    method: payload.method || "mobile_money",
    phoneNumber: payload.phoneNumber,
    status: "pending",
    metadata: payload.metadata || {},
    provider: "mock",
    externalRef: `CHK-${Math.random().toString(36).slice(2, 10).toUpperCase()}`
  });

  if (payload.autoConfirm !== false) {
    payment.status = "paid";
    payment.transactionId = generateTxnId();
    payment.paidAt = new Date();
    await payment.save();
  }

  await syncLoadPayment(load._id, payment);
  const populated = await Payment.findById(payment._id)
    .populate("shipment", "trackingId status paymentStatus paymentAmount pickupCity deliveryCity")
    .populate("payer", "name email role");

  return res.status(201).json({
    success: true,
    data: populated,
    message: payment.status === "paid" ? "Payment completed" : "Payment initiated"
  });
}

async function getPayments(req, res) {
  const query = {};
  if (req.query.status) query.status = req.query.status;
  if (req.query.shipmentId) query.shipment = req.query.shipmentId;
  if (req.query.mine === "true") query.payer = req.user._id;
  if (!isPrivilegedRole(req.user.role) && req.query.mine !== "true") {
    query.payer = req.user._id;
  }

  const payments = await Payment.find(query)
    .populate("shipment", "trackingId status paymentStatus paymentAmount pickupCity deliveryCity")
    .populate("payer", "name email role")
    .sort({ createdAt: -1 });

  return res.json({
    success: true,
    data: payments
  });
}

async function getPayment(req, res) {
  const payment = await Payment.findById(req.params.id)
    .populate("shipment", "trackingId status paymentStatus paymentAmount pickupCity deliveryCity")
    .populate("payer", "name email role");
  if (!payment) throw createError(404, "Payment not found");

  if (!isPrivilegedRole(req.user.role) && payment.payer._id.toString() !== req.user._id.toString()) {
    throw createError(403, "Not allowed to view this payment");
  }

  return res.json({
    success: true,
    data: payment
  });
}

async function updatePaymentStatus(req, res) {
  const payload = validatePaymentStatus(req.body);
  const payment = await Payment.findById(req.params.id);
  if (!payment) throw createError(404, "Payment not found");

  const isPayer = payment.payer.toString() === req.user._id.toString();
  if (!isPayer && !isPrivilegedRole(req.user.role)) {
    throw createError(403, "Not allowed to update this payment");
  }

  payment.status = payload.status;
  payment.reason = payload.reason;
  if (payload.transactionId) payment.transactionId = payload.transactionId;
  if (payload.externalRef) payment.externalRef = payload.externalRef;

  if (payload.status === "paid") payment.paidAt = new Date();
  if (payload.status === "failed") payment.failedAt = new Date();
  if (payload.status === "refunded") payment.refundedAt = new Date();
  await payment.save();

  await syncLoadPayment(payment.shipment, payment);
  const populated = await Payment.findById(payment._id)
    .populate("shipment", "trackingId status paymentStatus paymentAmount pickupCity deliveryCity")
    .populate("payer", "name email role");

  return res.json({
    success: true,
    data: populated,
    message: "Payment status updated"
  });
}

async function simulatePayment(req, res) {
  const payload = validateSimulatePayment(req.body);
  const payment = await Payment.findById(req.params.id);
  if (!payment) throw createError(404, "Payment not found");

  if (!isPrivilegedRole(req.user.role)) {
    throw createError(403, "Only staff/admin can simulate payment outcomes");
  }

  if (payload.outcome === "success") {
    payment.status = "paid";
    payment.transactionId = payment.transactionId || generateTxnId();
    payment.paidAt = new Date();
  } else if (payload.outcome === "failed") {
    payment.status = "failed";
    payment.reason = payload.reason || "Mock payment failure";
    payment.failedAt = new Date();
  } else {
    payment.status = "pending";
  }

  await payment.save();
  await syncLoadPayment(payment.shipment, payment);

  const populated = await Payment.findById(payment._id)
    .populate("shipment", "trackingId status paymentStatus paymentAmount pickupCity deliveryCity")
    .populate("payer", "name email role");

  return res.json({
    success: true,
    data: populated,
    message: "Payment simulation applied"
  });
}

async function getLatestShipmentPayment(req, res) {
  const payment = await Payment.findOne({ shipment: req.params.shipmentId })
    .sort({ createdAt: -1 })
    .populate("shipment", "trackingId status paymentStatus paymentAmount pickupCity deliveryCity")
    .populate("payer", "name email role");

  if (!payment) throw createError(404, "No payment found for this shipment");
  return res.json({
    success: true,
    data: payment
  });
}

module.exports = {
  createPayment,
  getPayments,
  getPayment,
  updatePaymentStatus,
  simulatePayment,
  getLatestShipmentPayment
};
