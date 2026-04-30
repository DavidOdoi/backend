const AfricasTalking = require('africastalking');

const africasTalking = AfricasTalking({
  apiKey: process.env.AT_API_KEY,
  username: process.env.AT_USERNAME || "sandbox"
});

module.exports = africasTalking;
