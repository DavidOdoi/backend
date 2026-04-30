const express = require("express");
const { register, login, me } = require("../controllers/auth.controller");
const rateLimit = require("express-rate-limit");
const { auth } = require("../middleware/auth");

const router = express.Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50
});

router.use(limiter);

router.post("/register", register);
router.post("/login", login);
router.get("/me", auth, me);

module.exports = router;
