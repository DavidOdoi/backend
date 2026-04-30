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

const locationGeoSchema = z
  .object({
    lat: z.preprocess(toNumber, z.number().min(-90).max(90)),
    lng: z.preprocess(toNumber, z.number().min(-180).max(180))
  })
  .partial();

const truckBaseSchema = z.object({
  plateNumber: z.string().trim().min(3, "plateNumber is required"),
  type: z.string().trim().min(1, "type is required"),
  capacity: z.preprocess(toNumber, z.number().nonnegative("capacity must be non-negative")),
  status: z.enum(["available", "in_use", "maintenance", "offline"]).optional(),
  currentLocation: z.string().trim().optional(),
  currentLocationGeo: locationGeoSchema.optional(),
  insuranceExpiry: z.preprocess(toDate, z.date()).optional(),
  serviceDueDate: z.preprocess(toDate, z.date()).optional(),
  notes: z.string().trim().optional()
});

const createTruckSchema = truckBaseSchema.strict();
const updateTruckSchema = truckBaseSchema.partial().strict();

const assignDriverSchema = z.object({
  driverId: z.string().trim().min(1, "driverId is required")
});

const movementSchema = z.object({
  location: z.string().trim().min(1, "location is required"),
  lat: z.preprocess(toNumber, z.number().min(-90).max(90)).optional(),
  lng: z.preprocess(toNumber, z.number().min(-180).max(180)).optional(),
  shipmentId: z.string().trim().optional(),
  status: z.enum(["assigned", "in_transit", "delivered"]).optional(),
  note: z.string().trim().optional()
});

module.exports = {
  validateCreateTruck: (body) => createTruckSchema.parse(body),
  validateUpdateTruck: (body) => updateTruckSchema.parse(body),
  validateAssignDriver: (body) => assignDriverSchema.parse(body),
  validateMovement: (body) => movementSchema.parse(body)
};
