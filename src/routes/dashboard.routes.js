const express = require("express");
const { getOverview } = require("../controllers/dashboard.controller");
const { auth } = require("../middleware/auth");

const router = express.Router();

router.get("/overview", auth, getOverview);

module.exports = router;
