// SMS Service - Twilio integration for notifications
const fetchFn = global.fetch
  ? global.fetch.bind(global)
  : (...args) => import("node-fetch").then((mod) => mod.default(...args));

const SMS_ENABLED = process.env.SMS_ENABLED === 'true';
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

/**
 * Send SMS notification via Twilio
 * @param {string} toPhone - Recipient phone number (E.164 format: +256...)
 * @param {string} message - SMS message content
 * @returns {Promise<{success: boolean, sid?: string, error?: string}>}
 */
async function sendSMS(toPhone, message) {
  if (!SMS_ENABLED) {
    console.log(`[SMS Mock] To: ${toPhone}, Message: ${message}`);
    return { success: true, sid: 'mock-' + Date.now() };
  }

  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    console.warn('SMS: Twilio credentials not configured');
    return { success: false, error: 'SMS service not configured' };
  }

  try {
    const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
    const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;

    const formData = new URLSearchParams();
    formData.append('From', TWILIO_PHONE_NUMBER);
    formData.append('To', toPhone);
    formData.append('Body', message);

    const res = await fetchFn(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData.toString()
    });

    if (!res.ok) {
      const error = await res.json();
      console.error('Twilio API error:', error);
      return { success: false, error: error.message || 'Failed to send SMS' };
    }

    const data = await res.json();
    return { success: true, sid: data.sid };
  } catch (err) {
    console.error('SMS service error:', err?.message || err);
    return { success: false, error: err?.message || 'SMS service error' };
  }
}

/**
 * Send driver notification SMS
 */
async function notifyDriver(driverPhone, loadDetails) {
  const message = `New load: ${loadDetails.cargoType} from ${loadDetails.pickupLocation} to ${loadDetails.deliveryLocation}. Payout: ${loadDetails.price}. Check app for details.`;
  return sendSMS(driverPhone, message);
}

/**
 * Send customer notification SMS
 */
async function notifyCustomer(customerPhone, driverDetails, eta) {
  const message = `Your cargo is on the way! Driver ${driverDetails.name} will pick it up. ETA: ${eta}. Contact: ${driverDetails.phone}`;
  return sendSMS(customerPhone, message);
}

/**
 * Send trader notification SMS when a driver accepts a load
 */
async function notifyTrader(traderPhone, driverDetails, loadDetails) {
  const message = `Your ${loadDetails.cargoType || 'load'} from ${loadDetails.pickupLocation || 'pickup'} to ${loadDetails.deliveryLocation || 'delivery'} has been accepted by ${driverDetails.name || 'a driver'}. Driver contact: ${driverDetails.phone || 'N/A'}.`;
  return sendSMS(traderPhone, message);
}

/**
 * Send status update SMS
 */
async function sendStatusUpdate(phone, status, loadDetails) {
  const messages = {
    'in_transit': `Your cargo from ${loadDetails.pickupLocation} is now in transit to ${loadDetails.deliveryLocation}`,
    'delivered': `Your cargo has been delivered! Thank you for using our service.`,
    'cancelled': `Your load shipment has been cancelled.`
  };

  const message = messages[status] || `Your shipment status: ${status}`;
  return sendSMS(phone, message);
}

module.exports = {
  sendSMS,
  notifyDriver,
  notifyCustomer,
  notifyTrader,
  sendStatusUpdate
};
