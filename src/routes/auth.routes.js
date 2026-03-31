const express = require("express");
const { register, login } = require("../controllers/auth.controller");
const rateLimit = require("express-rate-limit");

const router = express.Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50
});

router.use(limiter);

router.post("/register", register);
router.post("/login", login);

module.exports = router;
