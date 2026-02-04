const request = require('supertest');
const app = require('../../server');
const User = require('../../models/User');
const { registerVerifyLogin, authHeader } = require('./authHelpers');

describe('Auth email verification flow and auth middleware branches', () => {
  test('register-start basic flow and cooldown branch (second call still 200)', async () => {
    const email = `flow-${Date.now()}@example.com`;

    // Start registration
    const start1 = await request(app)
      .post('/api/v1/auth/register-start')
      .send({ name: 'Flow', email, password: 'Pass123!' })
      .expect(200);
    expect(start1.body.success).toBe(true);

    // Second call within cooldown window → still 200 via early return (no resend)
    const start2 = await request(app)
      .post('/api/v1/auth/register-start')
      .send({ name: 'Flow', email, password: 'Pass123!' })
      .expect(200);
    expect(start2.body.success).toBe(true);
  });

  test('register-verify validation and attempts/lockout branches', async () => {
    const email = `verify-${Date.now()}@example.com`;

    // Missing fields → 400
    await request(app).post('/api/v1/auth/register-verify').send({}).expect(400);
    await request(app).post('/api/v1/auth/register-verify').send({ email }).expect(400);

    // Prepare an unverified user with a code by calling register-start
    await request(app)
      .post('/api/v1/auth/register-start')
      .send({ name: 'V', email, password: 'Pass123!' })
      .expect(200);

    // Wrong code 5 times → 400 each time (attempts increase)
    for (let i = 0; i < 5; i++) {
      await request(app)
        .post('/api/v1/auth/register-verify')
        .send({ email, code: '000000' })
        .expect(400);
    }

    // 6th attempt → 429 (lockout)
    await request(app)
      .post('/api/v1/auth/register-verify')
      .send({ email, code: '000000' })
      .expect(429);
  });

  test('protect middleware can read token from Cookie when Authorization header absent', async () => {
    const email = `cookie-${Date.now()}@example.com`;
    const password = 'Pass123!';

    // /auth/register returns a JSON token; simulate cookie-based auth manually in test
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'CookieUser', email, password, role: 'user' })
      .expect(200);
    const token = reg.body.token;
    expect(token).toBeDefined();
    const cookieHeader = [`token=${token}; HttpOnly`];

    // Access /auth/me WITH cookie but WITHOUT Authorization header
    const me = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', cookieHeader)
      .expect(200);

    expect(me.body.success).toBe(true);
    expect(me.body.data.email).toBe(email);
  });

  test('register-start early-return branch when user already verified', async () => {
    const email = `verified-${Date.now()}@example.com`;
    const password = 'Pass123!';
    
    // Create a verified user directly
    await registerVerifyLogin({ name: 'V2', email, password, role: 'user' });

    const res = await request(app)
      .post('/api/v1/auth/register-start')
      .send({ name: 'V2', email, password })
      .expect(200);
    expect(res.body.success).toBe(true);
  });
});
