const { z } = require("zod");

const toNumber = (value) => {
  if (value === "" || value === undefined || value === null) return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? value : parsed;
};

const createPaymentSchema = z.object({
  shipmentId: z.string().trim().min(1, "shipmentId is required"),
  amount: z.preprocess(toNumber, z.number().nonnegative()).optional(),
  currency: z.string().trim().min(3).max(5).optional(),
  method: z.enum(["card", "mobile_money", "bank_transfer", "cash", "wallet"]).optional(),
  phoneNumber: z.string().trim().optional(),
  autoConfirm: z.boolean().optional(),
  metadata: z.record(z.any()).optional()
});

const updateStatusSchema = z.object({
  status: z.enum(["pending", "paid", "failed", "refunded"]),
  reason: z.string().trim().optional(),
  transactionId: z.string().trim().optional(),
  externalRef: z.string().trim().optional()
});

const simulateSchema = z.object({
  outcome: z.enum(["success", "failed", "pending"]).default("success"),
  reason: z.string().trim().optional()
});

module.exports = {
  validateCreatePayment: (body) => createPaymentSchema.parse(body),
  validatePaymentStatus: (body) => updateStatusSchema.parse(body),
  validateSimulatePayment: (body) => simulateSchema.parse(body)
};
