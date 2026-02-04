const request = require('supertest');
const app = require('../../server');
const User = require('../../models/User');

/**
 * Registers a user, manually verifies them in the DB, and logs them in.
 * Returns the JWT token.
 * Uses the flow from auth.test.js
 */
const registerVerifyLogin = async ({ name = 'Test User', email, password = 'Pass123!', role = 'user' }) => {
  // 1. Register
  await request(app)
    .post('/api/v1/auth/register')
    .send({ name, email, password, role })
    .expect(200);

  // 2. Manually verify (skipping actual email flow for speed in helper)
  await User.updateOne({ email }, { isVerified: true });

  // 3. Login
  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password })
    .expect(200);

  // 4. Get userId from DB
  const user = await User.findOne({ email });

  return { token: loginRes.body.token, userId: user._id };
};

/**
 * Helper to format the Authorization header
 * optional: authHeader(token) helper for header setting
 */
const authHeader = (token) => ({
  'Authorization': `Bearer ${token}`
});

module.exports = {
  registerVerifyLogin,
  authHeader
};
