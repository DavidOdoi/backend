const africasTalking = require("../config/africastalking");

const sms = africasTalking.SMS;

/**
 * Send SMS to one or multiple recipients
 * @param {string|string[]} to - Phone number(s) in international format (e.g., +256765830691)
 * @param {string} message - SMS message content
 * @param {string} from - Optional sender ID (depends on account)
 * @returns {Promise} SMS response
 */
async function sendSMS(to, message, from = "AFRICASTKNG") {
  try {
    // Ensure 'to' is an array
    const recipients = Array.isArray(to) ? to : [to];

    const result = await sms.send({
      to: recipients,
      message: message,
      from: from
    });

    console.log("SMS sent successfully:", result);
    return result;
  } catch (err) {
    console.error("Error sending SMS:", err);
    throw err;
  }
}

/**
 * Send verification SMS (helper function)
 * @param {string} phoneNumber - Recipient phone number
 * @param {string} code - Verification code
 * @returns {Promise} SMS response
 */
async function sendVerificationSMS(phoneNumber, code) {
  const message = `Your verification code is: ${code}. Do not share this code with anyone.`;
  return sendSMS(phoneNumber, message);
}

/**
 * Send notification SMS (helper function)
 * @param {string} phoneNumber - Recipient phone number
 * @param {string} message - Notification message
 * @returns {Promise} SMS response
 */
async function sendNotificationSMS(phoneNumber, message) {
  return sendSMS(phoneNumber, message);
}

module.exports = {
  sendSMS,
  sendVerificationSMS,
  sendNotificationSMS
};
