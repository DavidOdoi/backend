const jwt = require("jsonwebtoken");
const { User } = require("../models/user.model");
const { Driver } = require("../models/driver.model");
const { validateRegister, validateLogin } = require("../validators/auth.validator");

const createError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

const USER_ROLE_BY_INPUT = {
  trader: "trader",
  customer: "trader",
  driver: "driver",
  staff: "driver",
  admin: "admin"
};

const PLATFORM_ROLE_BY_USER_ROLE = {
  trader: "customer",
  customer: "customer",
  driver: "staff",
  staff: "staff",
  admin: "admin"
};

function normalizeRoleInput(inputRole) {
  const normalized = (inputRole || "customer").toString().toLowerCase();
  return USER_ROLE_BY_INPUT[normalized] || "trader";
}

function serializeUser(user) {
  return {
    id: user._id,
    name: user.name,
    companyName: user.companyName,
    location: user.location,
    businessType: user.businessType,
    tradingVolume: user.tradingVolume,
    email: user.email,
    phone: user.phone,
    role: user.role,
    platformRole: PLATFORM_ROLE_BY_USER_ROLE[user.role] || "customer",
    driverProfile: user.driverProfile
  };
}

function signToken(user) {
  return jwt.sign(
    {
      sub: user._id.toString(),
      role: user.role
    },
    process.env.JWT_SECRET,
    {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
      issuer: process.env.JWT_ISSUER || "logistics-backend"
    }
  );
}

async function register(req, res) {
  console.log("Register endpoint hit with body:", req.body);
  
  try {
    console.log("Validating registration data...");
    const payload = validateRegister(req.body);
    console.log("Validation passed, payload:", payload);
    
    const mappedRole = normalizeRoleInput(payload.role);
    console.log("Mapped role:", mappedRole);

    const exists = await User.findOne({ email: payload.email });
    if (exists) {
      console.log("Email already exists:", payload.email);
      throw createError(409, "Email already in use");
    }

    console.log("Creating user with data:", { ...payload, role: mappedRole });
    const user = await User.create({
      ...payload,
      role: mappedRole
    });
    console.log("User created successfully:", user._id);

    // If driver role, create a stub driver profile linked to user
    if (mappedRole === "driver") {
      console.log("Creating driver profile for user:", user._id);
      const driver = await Driver.create({
        name: payload.name,
        phone: payload.phone,
        email: payload.email,
        maxWeight: 0,
        currentLocation: "Unknown"
      });
      user.driverProfile = driver._id;
      await user.save();
      console.log("Driver profile created:", driver._id);
    }

    console.log("Signing JWT token...");
    const token = signToken(user);
    console.log("Token signed successfully");

    console.log("Sending success response...");
    return res.status(201).json({
      success: true,
      data: {
        user: serializeUser(user),
        token
      },
      message: "Registered"
    });
  } catch (error) {
    console.error("Registration error:", error);
    throw error;
  }
}

async function login(req, res) {
  try {
    const { email, password } = validateLogin(req.body);
    const user = await User.findOne({ email });
    if (!user) {
      throw createError(401, "Invalid credentials");
    }

    const valid = await user.comparePassword(password);
    if (!valid) {
      throw createError(401, "Invalid credentials");
    }

    const token = signToken(user);
    return res.json({
      success: true,
      data: {
        user: serializeUser(user),
        token
      },
      message: "Logged in"
    });
  } catch (error) {
    throw error;
  }
}

async function me(req, res) {
  try {
    if (!req.user) {
      throw createError(401, "Unauthorized");
    }

    return res.json({
      success: true,
      data: serializeUser(req.user)
    });
  } catch (error) {
    throw error;
  }
}

module.exports = { register, login, me };
