const express = require("express");
const { getMe, updateMe, searchUsers } = require("../controllers/user.controller");
const { auth } = require("../middleware/auth");

const router = express.Router();

router.get("/search", auth, searchUsers);
router.get("/me", auth, getMe);
router.patch("/me", auth, updateMe);

module.exports = router;
