let _client = null;

function getClient() {
  if (_client) return _client;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token || sid.startsWith("ACxxxxxxx")) return null;
  const twilio = require("twilio");
  _client = twilio(sid, token);
  return _client;
}

function toE164(phone) {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("0") && digits.length === 10) {
    return `+256${digits.slice(1)}`;
  }
  if (!phone.startsWith("+")) return `+${digits}`;
  return phone;
}

async function sendTwilioSMS(to, body) {
  const client = getClient();
  if (!client) throw new Error("Twilio not configured — add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER to .env");
  const normalized = toE164(to);
  return client.messages.create({
    from: process.env.TWILIO_PHONE_NUMBER,
    to: normalized,
    body
  });
}

async function sendWhatsApp(to, body) {
  const client = getClient();
  if (!client) throw new Error("Twilio not configured");
  const normalized = toE164(to);
  const from = process.env.TWILIO_WHATSAPP_NUMBER || "+14155238886";
  return client.messages.create({
    from: `whatsapp:${from}`,
    to: `whatsapp:${normalized}`,
    body
  });
}

function isTwilioConfigured() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  return !!(sid && !sid.startsWith("ACxxxxxxx") && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_PHONE_NUMBER);
}

module.exports = { sendTwilioSMS, sendWhatsApp, isTwilioConfigured, toE164 };
