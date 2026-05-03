const { Notification } = require("../models/notification.model");

const createError = (status, message) => {
  const err = new Error(message);
  err.status = status;
  return err;
};

async function getNotifications(req, res) {
  const limit = Math.min(Number(req.query.limit) || 20, 100);
  const page = Math.max(Number(req.query.page) || 1, 1);
  const unreadOnly = req.query.unread === "true";

  const filter = { recipient: req.user._id };
  if (unreadOnly) filter.read = false;

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Notification.countDocuments({ recipient: req.user._id }),
    Notification.countDocuments({ recipient: req.user._id, read: false })
  ]);

  return res.json({
    success: true,
    data: { notifications, total, page, unreadCount }
  });
}

async function markRead(req, res) {
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, recipient: req.user._id },
    { read: true, readAt: new Date() },
    { new: true }
  );
  if (!notification) throw createError(404, "Notification not found");
  return res.json({ success: true, data: notification });
}

async function markAllRead(req, res) {
  await Notification.updateMany(
    { recipient: req.user._id, read: false },
    { read: true, readAt: new Date() }
  );
  return res.json({ success: true, message: "All notifications marked as read" });
}

module.exports = { getNotifications, markRead, markAllRead };
