const { z } = require("zod");

const toNumber = (value) => {
  if (value === "" || value === undefined || value === null) return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? value : parsed;
};

const toDate = (value) => {
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed;
};

const loadBaseSchema = z.object({
  pickupLocation: z.string().trim().min(1, "pickupLocation is required"),
  deliveryLocation: z.string().trim().min(1, "deliveryLocation is required"),
  cargoType: z.string().trim().min(1, "cargoType is required"),
  weight: z.preprocess(toNumber, z.number().nonnegative("weight must be a number")),

  price: z.preprocess(toNumber, z.number().nonnegative()).optional(),
  pickupDate: z.preprocess(toDate, z.date()).optional(),
  contactName: z.string().trim().optional(),
  contactPhone: z.string().trim().optional(),

  loadType: z.string().trim().optional(),
  length: z.preprocess(toNumber, z.number().nonnegative()).optional(),
  width: z.preprocess(toNumber, z.number().nonnegative()).optional(),
  height: z.preprocess(toNumber, z.number().nonnegative()).optional(),
  quantity: z.preprocess(toNumber, z.number().nonnegative()).optional(),
  description: z.string().trim().optional(),
  pickupCity: z.string().trim().optional(),
  pickupTime: z.string().trim().optional(),
  deliveryCity: z.string().trim().optional(),
  deliveryDate: z.preprocess(toDate, z.date()).optional(),
  deliveryTime: z.string().trim().optional(),
  deliveryContact: z.string().trim().optional(),
  deliveryPhone: z.string().trim().optional(),
  truckType: z.string().trim().optional(),
  specialRequirements: z.array(z.string().trim()).optional(),
  budget: z.preprocess(toNumber, z.number().nonnegative()).optional(),
  notes: z.string().trim().optional(),
  status: z.enum(["open", "assigned", "in_transit", "delivered", "cancelled"]).optional()
});

const createLoadSchema = loadBaseSchema.strict();
const updateLoadSchema = loadBaseSchema.partial().strict();

function validateCreate(body) {
  return createLoadSchema.parse(body);
}

function validateUpdate(body) {
  return updateLoadSchema.parse(body);
}

const assignDriverSchema = z.object({
  driverId: z.string().trim().min(1, "driverId is required")
});

function validateAssign(body) {
  return assignDriverSchema.parse(body);
}

module.exports = { validateCreate, validateUpdate, validateAssign };
