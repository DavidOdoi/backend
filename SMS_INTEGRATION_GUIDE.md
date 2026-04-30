# Africa's Talking SMS Integration Setup Guide

## ✅ What's Been Configured

### 1. **Installation** - COMPLETE ✓
```bash
npm install africastalking
```
Already installed in your project.

### 2. **Configuration Files Created**

#### [src/config/africastalking.js](src/config/africastalking.js)
Initializes the Africa's Talking SDK with your API credentials from the `.env` file.

#### [src/services/sms.service.js](src/services/sms.service.js)
Provides three main functions:
- `sendSMS(to, message, from)` - Send SMS to one or multiple recipients
- `sendVerificationSMS(phoneNumber, code)` - Send verification codes
- `sendNotificationSMS(phoneNumber, message)` - Send notifications

### 3. **Test Script Created**
```bash
npm run test:sms
```
Located at `src/scripts/testSMS.js`

---

## 🔧 Current Issue

**Status**: 401 Unauthorized Error

This indicates an authentication problem with your Africa's Talking account, not a code problem.

### Troubleshooting Steps

#### 1. **Verify API Key** ✓
Your `.env` file has:
```
AT_API_KEY=atsk_4e73fc1de18bf82e4d9407d219bd1f69c89921bf43f6fd18a511e6940a43550c42086032
AT_USERNAME=sandbox
```

#### 2. **Check Africa's Talking Dashboard**
1. Go to [https://africastalking.com/sandbox](https://africastalking.com/sandbox)
2. Sign in with your credentials
3. Verify:
   - API Key is valid and active
   - SMS service is enabled
   - Your account has SMS credits (for sandbox, you get free test messages)
   - The account is in **sandbox mode** (for testing)

#### 3. **Verify Phone Number Format**
The number provided: `+256765830691`
- ✓ Correct international format for Uganda
- ✓ Includes country code (+256)
- ✓ Valid Ugandan mobile number

#### 4. **Potential Causes of 401 Error**
- [ ] API key expired or regenerated
- [ ] Account suspended or disabled
- [ ] Wrong environment (sandbox vs production)
- [ ] API key doesn't have SMS permissions enabled

---

## 📝 How to Use in Your Code

### Option 1: Send a Single SMS
```javascript
const { sendSMS } = require('./services/sms.service');

await sendSMS('+256765830691', 'Hello, this is a test!');
```

### Option 2: Send to Multiple Recipients
```javascript
const { sendSMS } = require('./services/sms.service');

await sendSMS(
  ['+256765830691', '+256700000000'],
  'Hello everyone!'
);
```

### Option 3: Use Helper Functions
```javascript
const { sendVerificationSMS, sendNotificationSMS } = require('./services/sms.service');

// Send verification code
await sendVerificationSMS('+256765830691', '123456');

// Send notification
await sendNotificationSMS('+256765830691', 'Your order has been delivered!');
```

### Option 4: Integrate with Your Controllers
```javascript
// In src/controllers/auth.controller.js
const { sendVerificationSMS } = require('../services/sms.service');

exports.sendOTP = async (req, res) => {
  try {
    const { phoneNumber } = req.body;
    const code = Math.random().toString(36).substring(2, 8);
    
    await sendVerificationSMS(phoneNumber, code);
    
    res.status(200).json({
      message: 'Verification code sent',
      code: code // In production, don't send this to client
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
```

---

## 🚀 Next Steps to Fix the 401 Error

### Step 1: Regenerate API Key
1. Go to [https://africastalking.com](https://africastalking.com)
2. Log in to your account
3. Navigate to **Settings** → **API Keys**
4. Generate a new API key
5. Update your `.env` file with the new key:
```
AT_API_KEY=your_new_api_key_here
```

### Step 2: Verify SMS Permissions
1. In your Africa's Talking dashboard, check:
   - SMS module is enabled
   - You're using the correct username (usually "sandbox" for testing or your company name for production)

### Step 3: Check Account Status
1. Make sure your account is active
2. Verify you have SMS credits available
3. For sandbox, you get free test credits

### Step 4: Test Again
```bash
npm run test:sms
```

---

## 📱 Integration Examples

### Send SMS on Driver Signup (driver.controller.js)
```javascript
const { sendVerificationSMS } = require('../services/sms.service');

exports.createDriver = async (req, res) => {
  try {
    // ... create driver code ...
    
    // Send welcome SMS
    await sendSMS(
      req.body.phoneNumber,
      'Welcome to Simba Logistics! Your account has been created.'
    );
    
    res.status(201).json({ driver });
  } catch (err) {
    // Continue even if SMS fails
    console.error('SMS error:', err);
    res.status(500).json({ error: err.message });
  }
};
```

### Send SMS on Load Assignment (load.controller.js)
```javascript
const { sendNotificationSMS } = require('../services/sms.service');

exports.assignLoad = async (req, res) => {
  try {
    // ... assign load code ...
    
    // Notify driver
    await sendNotificationSMS(
      driver.phoneNumber,
      `New load assigned! Pickup: ${load.pickupLocation}. Accept or decline?`
    );
    
    res.status(200).json({ load });
  } catch (err) {
    console.error('SMS error:', err);
    res.status(500).json({ error: err.message });
  }
};
```

### Send SMS on Payment Confirmation (payment.controller.js)
```javascript
const { sendNotificationSMS } = require('../services/sms.service');

exports.confirmPayment = async (req, res) => {
  try {
    // ... payment code ...
    
    // Send payment confirmation SMS
    await sendNotificationSMS(
      payment.phoneNumber,
      `Payment of KES ${payment.amount} confirmed. Reference: ${payment.reference}`
    );
    
    res.status(200).json({ payment });
  } catch (err) {
    console.error('SMS error:', err);
    res.status(500).json({ error: err.message });
  }
};
```

---

## ⚠️ Best Practices

1. **Always use try-catch** - SMS delivery might fail
2. **Don't block on SMS** - Send SMS asynchronously in the background
3. **Use queues for reliability** - Consider using Bull or similar for SMS queues
4. **Log SMS events** - Track all SMS sends in your database
5. **Rate limiting** - Implement rate limiting to prevent abuse
6. **PII handling** - Never log full phone numbers; truncate or hash them

---

## 📚 File Structure
```
src/
├── config/
│   └── africastalking.js         ← SDK initialization
├── services/
│   └── sms.service.js            ← SMS functions
├── scripts/
│   └── testSMS.js                ← Test script
├── controllers/                  ← Use SMS in controllers
│   ├── auth.controller.js
│   ├── driver.controller.js
│   ├── load.controller.js
│   ├── payment.controller.js
│   └── ...
└── .env                          ← API credentials
```

---

## 🔗 Useful Links
- [Africa's Talking Docs](https://africastalking.com/sms/api)
- [Africa's Talking SDK Node.js](https://github.com/AfricasTalkingLtd/africastalking-node.js)
- [Sandbox Testing Guide](https://africastalking.com/sandbox)
