const { User } = require("../models/user.model");

const createError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

const ALLOWED_FIELDS = [
  "name",
  "companyName",
  "location",
  "businessType",
  "tradingVolume",
  "phone"
];

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
    driverProfile: user.driverProfile
  };
}

async function getMe(req, res) {
  if (!req.user) throw createError(401, "Unauthorized");
  return res.json({
    success: true,
    data: serializeUser(req.user)
  });
}

async function updateMe(req, res) {
  if (!req.user) throw createError(401, "Unauthorized");

  const updates = {};
  for (const key of ALLOWED_FIELDS) {
    if (req.body[key] !== undefined) {
      updates[key] = req.body[key];
    }
  }

  if (Object.keys(updates).length === 0) {
    throw createError(400, "No valid profile fields provided");
  }

  const user = await User.findByIdAndUpdate(req.user._id, updates, {
    new: true,
    runValidators: true
  }).select("-password");

  return res.json({
    success: true,
    data: serializeUser(user),
    message: "Profile updated"
  });
}

module.exports = {
  getMe,
  updateMe
};
