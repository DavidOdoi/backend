const nodemailer = require("nodemailer");

// Create transporter using environment variables
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

/**
 * Send an email
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} text - Email body (plain text)
 * @param {string} html - Email body (HTML format, optional)
 * @returns {Promise} Email response
 */
async function sendEmail(to, subject, text, html = null) {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to,
      subject,
      text,
      ...(html && { html }) // Include html if provided
    };

    const info = await transporter.sendMail(mailOptions);
    
    console.log("✅ Email sent successfully:", info.response);
    return info;
  } catch (error) {
    console.error("❌ Email failed:", error.message);
    throw error;
  }
}

/**
 * Send a verification email
 * @param {string} to - Recipient email address
 * @param {string} code - Verification code
 * @returns {Promise} Email response
 */
async function sendVerificationEmail(to, code) {
  const subject = "Email Verification - Simba Logistics";
  const text = `Your verification code is: ${code}\n\nDo not share this code with anyone.`;
  const html = `
    <h2>Email Verification</h2>
    <p>Your verification code is:</p>
    <h1 style="color: #007bff;">${code}</h1>
    <p>Do not share this code with anyone.</p>
  `;
  
  return sendEmail(to, subject, text, html);
}

/**
 * Send a password reset email
 * @param {string} to - Recipient email address
 * @param {string} resetLink - Password reset link
 * @returns {Promise} Email response
 */
async function sendPasswordResetEmail(to, resetLink) {
  const subject = "Password Reset - Simba Logistics";
  const text = `Click the link below to reset your password:\n${resetLink}\n\nIf you didn't request this, ignore this email.`;
  const html = `
    <h2>Password Reset</h2>
    <p>Click the link below to reset your password:</p>
    <a href="${resetLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a>
    <p style="margin-top: 20px; color: #666;">If you didn't request this, ignore this email.</p>
  `;
  
  return sendEmail(to, subject, text, html);
}

/**
 * Send a welcome email
 * @param {string} to - Recipient email address
 * @param {string} name - User's name
 * @returns {Promise} Email response
 */
async function sendWelcomeEmail(to, name) {
  const subject = "Welcome to Simba Logistics!";
  const text = `Welcome ${name}!\n\nThank you for joining Simba Logistics. We're excited to have you on board.`;
  const html = `
    <h2>Welcome to Simba Logistics!</h2>
    <p>Hi ${name},</p>
    <p>Thank you for joining <strong>Simba Logistics</strong>. We're excited to have you on board.</p>
    <p>Get started by exploring our features and connecting with drivers and shippers.</p>
  `;
  
  return sendEmail(to, subject, text, html);
}

/**
 * Send a notification email
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} message - Notification message
 * @returns {Promise} Email response
 */
async function sendNotificationEmail(to, subject, message) {
  return sendEmail(to, subject, message);
}

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendNotificationEmail
};
