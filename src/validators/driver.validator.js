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

const routeSchema = z.object({
  from: z.string().trim().optional(),
  to: z.string().trim().optional()
});

const driverBaseSchema = z.object({
  name: z.string().trim().min(1, "name is required"),
  phone: z.string().trim().min(1, "phone is required"),
  email: z.string().trim().email().optional(),

  truckTypes: z.array(z.string().trim()).min(1, "at least one truck type is required"),
  maxWeight: z.preprocess(toNumber, z.number().nonnegative("maxWeight must be a number")),
  cargoTypes: z.array(z.string().trim()).optional(),
  specialCapabilities: z.array(z.string().trim()).optional(),
  languages: z.array(z.string().trim()).optional(),

  currentLocation: z.string().trim().min(1, "currentLocation is required"),
  homeBase: z.string().trim().optional(),
  preferredRoutes: z.array(routeSchema).optional(),

  pricePerKm: z.preprocess(toNumber, z.number().positive("pricePerKm is required")),
  rating: z.preprocess(toNumber, z.number().min(0).max(5)).optional(),
  experienceYears: z.preprocess(toNumber, z.number().nonnegative()).optional(),
  verified: z.boolean().optional(),

  availability: z
    .object({
      status: z.enum(["available", "busy", "off"]).optional(),
      from: z.preprocess(toDate, z.date()).optional(),
      to: z.preprocess(toDate, z.date()).optional()
    })
    .optional()
});

const createDriverSchema = driverBaseSchema.strict();
const updateDriverSchema = driverBaseSchema.partial().strict();

function validateCreateDriver(body) {
  return createDriverSchema.parse(body);
}

function validateUpdateDriver(body) {
  return updateDriverSchema.parse(body);
}

module.exports = { validateCreateDriver, validateUpdateDriver };
