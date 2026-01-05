const request = require('supertest');
const app = require('../../server');
const User = require('../../models/User');
const { registerVerifyLogin, authHeader } = require('./authHelpers');

describe('Auth routes', () => {
  test('register, login, and access protected /me', async () => {
    const email = 'alice@example.com';
    const password = 'P@ssw0rd!';

    const { token } = await registerVerifyLogin({ name: 'Alice', email, password });

    // Access protected /me with Bearer token
    const me = await request(app)
      .get('/api/v1/auth/me')
      .set(authHeader(token))
      .expect(200);

    expect(me.body.success).toBe(true);
    expect(me.body.data).toBeDefined();
    expect(me.body.data.email).toBe(email);
  });

  test('protected /me rejects when no token', async () => {
    const res = await request(app).get('/api/v1/auth/me').expect(401);
    expect(res.body.success).toBe(false);
  });

  test('protected /me rejects with invalid JWT token', async () => {
    // Use an obviously invalid/malformed token
    const invalidToken = 'Bearer this.is.not.a.valid.token';
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', invalidToken)
      .expect(401);

    expect(res.body.success).toBe(false);
  });

  test('updatePassword rejects when currentPassword is invalid (401)', async () => {
    const email = 'dave@example.com';
    const password = 'Pass123!';

    // Register and login to get a valid token
    const { token } = await registerVerifyLogin({ name: 'Dave', email, password });

    // Attempt to update password with wrong currentPassword
    const res = await request(app)
      .put('/api/v1/auth/updatepassword')
      .set(authHeader(token))
      .send({ currentPassword: 'Wrong123!', newPassword: 'NewPass123!' })
      .expect(401);

    expect(res.body.success).toBe(false);
  });
});
