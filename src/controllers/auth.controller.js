const jwt = require("jsonwebtoken");
const { User } = require("../models/user.model");
const { Driver } = require("../models/driver.model");
const { validateRegister, validateLogin } = require("../validators/auth.validator");

const createError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

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
  const payload = validateRegister(req.body);

  const exists = await User.findOne({ email: payload.email });
  if (exists) {
    throw createError(409, "Email already in use");
  }

  const user = await User.create(payload);

  // If driver role, create a stub driver profile linked to user
  if (payload.role === "driver") {
    const driver = await Driver.create({
      name: payload.name,
      phone: payload.phone,
      email: payload.email,
      maxWeight: 0,
      currentLocation: "Unknown"
    });
    user.driverProfile = driver._id;
    await user.save();
  }

  const token = signToken(user);

  res.status(201).json({
    success: true,
    data: {
      user: {
        id: user._id,
        name: user.name,
        companyName: user.companyName,
        location: user.location,
        businessType: user.businessType,
        tradingVolume: user.tradingVolume,
        email: user.email,
        role: user.role,
        driverProfile: user.driverProfile
      },
      token
    },
    message: "Registered"
  });
}

async function login(req, res) {
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
  res.json({
    success: true,
    data: {
      user: {
        id: user._id,
        name: user.name,
        companyName: user.companyName,
        location: user.location,
        businessType: user.businessType,
        tradingVolume: user.tradingVolume,
        email: user.email,
        role: user.role,
        driverProfile: user.driverProfile
      },
      token
    },
    message: "Logged in"
  });
}

module.exports = { register, login };
