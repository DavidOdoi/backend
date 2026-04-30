const { z } = require("zod");

const registerSchema = z.object({
  name: z.string().trim().min(1, "name is required"),
  companyName: z.string().trim().optional(),
  location: z.string().trim().optional(),
  businessType: z.string().trim().optional(),
  tradingVolume: z.string().trim().optional(),
  email: z.string().trim().email("valid email required"),
  phone: z.string().trim().optional(),
  password: z.string().min(6, "password must be at least 6 characters"),
  role: z.enum(["customer", "staff", "admin", "trader", "driver"]).default("customer")
});

const loginSchema = z.object({
  email: z.string().trim().email("valid email required"),
  password: z.string().min(1, "password required")
});

module.exports = {
  validateRegister: (body) => registerSchema.parse(body),
  validateLogin: (body) => loginSchema.parse(body)
};
