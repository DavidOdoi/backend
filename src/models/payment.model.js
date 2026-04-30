const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    shipment: { type: mongoose.Schema.Types.ObjectId, ref: "Load", required: true, index: true },
    payer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, trim: true, default: "UGX" },
    method: {
      type: String,
      enum: ["card", "mobile_money", "bank_transfer", "cash", "wallet"],
      default: "mobile_money"
    },
    status: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
      index: true
    },
    provider: { type: String, trim: true, default: "mock" },
    transactionId: { type: String, trim: true, index: true },
    externalRef: { type: String, trim: true },
    phoneNumber: { type: String, trim: true },
    reason: { type: String, trim: true },
    metadata: { type: Object },
    paidAt: { type: Date },
    failedAt: { type: Date },
    refundedAt: { type: Date }
  },
  { timestamps: true }
);

paymentSchema.index({ shipment: 1, createdAt: -1 });
paymentSchema.index({ payer: 1, createdAt: -1 });

const Payment = mongoose.model("Payment", paymentSchema);

module.exports = { Payment };
