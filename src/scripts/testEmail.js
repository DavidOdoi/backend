require('dotenv').config();

const { 
  sendEmail, 
  sendVerificationEmail, 
  sendWelcomeEmail 
} = require("../services/email.service");

async function testEmail() {
  try {
    console.log("🚀 Testing Email Service...\n");
    
    // Test 1: Simple email
    console.log("📧 Test 1: Sending simple test email...");
    await sendEmail(
      "receiver@gmail.com",
      "Test from ELOGISTICA",
      "Hello! Email system is working perfectly."
    );
    console.log("✅ Test 1 passed!\n");

    // Test 2: Verification email
    console.log("📧 Test 2: Sending verification email...");
    await sendVerificationEmail("receiver@gmail.com", "123456");
    console.log("✅ Test 2 passed!\n");

    // Test 3: Welcome email
    console.log("📧 Test 3: Sending welcome email...");
    await sendWelcomeEmail("receiver@gmail.com", "John Doe");
    console.log("✅ Test 3 passed!\n");

    console.log("🎉 All email tests completed successfully!");

  } catch (err) {
    console.error("❌ Email test failed:");
    console.error(err);
    process.exit(1);
  }
}

// Run test
testEmail();
