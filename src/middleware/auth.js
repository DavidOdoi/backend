const jwt = require("jsonwebtoken");
const { User } = require("../models/user.model");

const createAuthError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

const ROLE_ALIASES = {
  trader: ["trader", "customer"],
  customer: ["customer", "trader"],
  driver: ["driver", "staff"],
  staff: ["staff", "driver"],
  admin: ["admin"]
};

async function auth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.toLowerCase().startsWith("bearer ")) {
    return next(createAuthError(401, "Unauthorized"));
  }

  const token = header.split(" ")[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub).select("-password");
    if (!user) {
      throw createAuthError(401, "Unauthorized");
    }
    req.user = user;
    next();
  } catch (err) {
    return next(createAuthError(401, "Unauthorized"));
  }
}

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return next(createAuthError(401, "Unauthorized"));
  const allowed = new Set(
    roles.flatMap((role) => ROLE_ALIASES[role] || [role])
  );
  const userCandidates = ROLE_ALIASES[req.user.role] || [req.user.role];
  const canAccess = userCandidates.some((role) => allowed.has(role));

  if (!canAccess) {
    return next(createAuthError(403, "Forbidden"));
  }
  next();
};

module.exports = { auth, requireRole };
