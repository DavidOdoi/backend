const { Notification } = require("../models/notification.model");
const { emitToUser } = require("./socket.service");
const { sendNotificationEmail } = require("./email.service");
const { sendNotificationSMS } = require("./sms.service");
const { sendTwilioSMS, isTwilioConfigured } = require("./twilio.service");

/**
 * Dispatch a notification via all channels:
 *   1. Persist to DB
 *   2. Real-time socket push
 *   3. SMS — Twilio if configured, Africa's Talking fallback
 *   4. Email
 *
 * SMS and email failures are swallowed so they never break the main flow.
 */
async function dispatchNotification({
  recipientId,
  recipientPhone,
  recipientEmail,
  type,
  title,
  body,
  data = {}
}) {
  // 1. Persist
  const notification = await Notification.create({
    recipient: recipientId,
    type,
    title,
    body,
    data
  });

  // 2. Real-time push
  emitToUser(recipientId?.toString(), "notification", {
    _id: notification._id,
    type,
    title,
    body,
    data,
    read: false,
    createdAt: notification.createdAt
  });

  // 3. SMS (fire-and-forget)
  if (recipientPhone) {
    const smsText = `${title}\n${body}`;
    if (isTwilioConfigured()) {
      sendTwilioSMS(recipientPhone, smsText).catch((err) =>
        console.error("[notify] Twilio SMS failed:", err.message)
      );
    } else {
      sendNotificationSMS(recipientPhone, smsText).catch((err) =>
        console.error("[notify] AT SMS failed:", err.message)
      );
    }
  }

  // 4. Email (fire-and-forget)
  if (recipientEmail) {
    sendNotificationEmail(recipientEmail, title, body).catch((err) =>
      console.error("[notify] Email failed:", err.message)
    );
  }

  return notification;
}

module.exports = { dispatchNotification };
