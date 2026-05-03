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

function serializePublic(user) {
  return {
    id: user._id,
    name: user.name,
    companyName: user.companyName || null,
    location: user.location || null,
    role: user.role
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

// Search users by name, company, phone, email, or role
async function searchUsers(req, res) {
  const { q, role, limit = 20 } = req.query;
  const isAdmin = req.user?.role === "admin";

  if (!q && !role) throw createError(400, "Provide q or role to search");

  const filter = {};
  if (role) filter.role = role;

  if (q) {
    const searchFields = [
      { name: { $regex: q, $options: "i" } },
      { companyName: { $regex: q, $options: "i" } },
      { location: { $regex: q, $options: "i" } }
    ];
    // Admins can also search by email and phone
    if (isAdmin) {
      searchFields.push({ email: { $regex: q, $options: "i" } });
      searchFields.push({ phone: { $regex: q, $options: "i" } });
    }
    filter.$or = searchFields;
  }

  const users = await User.find(filter)
    .select(isAdmin ? "-password" : "name companyName location role phone")
    .limit(Math.min(Number(limit), 50))
    .sort({ name: 1 });

  return res.json({
    success: true,
    data: isAdmin ? users.map(serializeUser) : users.map(serializePublic)
  });
}

module.exports = {
  getMe,
  updateMe,
  searchUsers
};
