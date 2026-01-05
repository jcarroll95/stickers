const request = require('supertest');
const crypto = require('crypto');
const app = require('../../server');
const User = require('../../models/User');
const { registerVerifyLogin, authHeader } = require('./authHelpers');

describe('Additional auth verification and resend branches', () => {
  test('login returns 403 when email not verified', async () => {
    const email = `unverified-${Date.now()}@example.com`;
    const password = 'Pass123!';

    await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'UV', email, password, role: 'user' })
      .expect(200);

    // Ensure user remains unverified (default)
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(403);

    expect(String(res.body.error || '')).toMatch(/verify/i);
  });

  test('register-resend validation and happy branches', async () => {
    // Missing email → 400
    await request(app).post('/api/v1/auth/register-resend').send({}).expect(400);

    // Unknown email → 200 (no enumeration)
    await request(app)
      .post('/api/v1/auth/register-resend')
      .send({ email: `none-${Date.now()}@example.com` })
      .expect(200);

    // Create an unverified user via register-start
    const email = `resend-${Date.now()}@example.com`;
    await request(app)
      .post('/api/v1/auth/register-start')
      .send({ name: 'R', email, password: 'Pass123!' })
      .expect(200);

    // Force cooldown expired by setting lastVerificationSentAt far in the past
    await User.updateOne({ email }, { lastVerificationSentAt: new Date(Date.now() - 61 * 1000) });

    // Now resend should take the send branch (still returns 200)
    const resend = await request(app)
      .post('/api/v1/auth/register-resend')
      .send({ email })
      .expect(200);
    expect(resend.body.success).toBe(true);
  });

  test('register-verify success path when code is correct', async () => {
    const email = `vsuccess-${Date.now()}@example.com`;
    // Start flow to create user
    await request(app)
      .post('/api/v1/auth/register-start')
      .send({ name: 'VS', email, password: 'Pass123!' })
      .expect(200);

    // Inject a known code by setting verifyEmailToken to hash of 123456
    const code = '123456';
    const hashed = crypto.createHash('sha256').update(code).digest('hex');
    await User.updateOne(
      { email },
      {
        verifyEmailToken: hashed,
        verifyEmailExpire: new Date(Date.now() + 15 * 60 * 1000),
        verifyEmailAttempts: 0
      }
    );

    const verify = await request(app)
      .post('/api/v1/auth/register-verify')
      .send({ email, code })
      .expect(200);

    expect(verify.body.success).toBe(true);
    expect(verify.body.token).toBeDefined();
  });
});
