require('dotenv').config();

const { sendSMS } = require("../services/sms.service");

async function testSMS() {
  try {
    console.log("🚀 Testing Africa's Talking SMS Service...\n");
    
    const phoneNumber = "+256765830691"; // Your test number
    const message = "Hello from my Node.js app! This is a test SMS from the Simba Logistics backend.";
    
    console.log(`📱 Sending SMS to: ${phoneNumber}`);
    console.log(`💬 Message: ${message}\n`);
    
    const result = await sendSMS(phoneNumber, message);
    
    console.log("✅ SMS sent successfully!");
    console.log("Response:", JSON.stringify(result, null, 2));
    
  } catch (err) {
    console.error("❌ Error sending SMS:");
    console.error(err);
    process.exit(1);
  }
}

// Run test
testSMS();
