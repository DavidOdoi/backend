const express = require("express");
const { getNotifications, markRead, markAllRead } = require("../controllers/notification.controller");
const { auth } = require("../middleware/auth");

const router = express.Router();

router.get("/", auth, getNotifications);
router.patch("/read-all", auth, markAllRead);
router.patch("/:id/read", auth, markRead);

module.exports = router;
