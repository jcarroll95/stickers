const request = require('supertest');
const app = require('../../server');

describe('Auth edge branches', () => {
  test('login sets Secure cookie when NODE_ENV=production', async () => {
    // Temporarily set production to cover cookie secure branch
    const prevEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    const email = `secure-${Date.now()}@example.com`;
    const password = 'Pass123!';

    await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'SC', email, password, role: 'user' })
      .expect(200);

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);

    // Restore env immediately
    process.env.NODE_ENV = prevEnv;

    const cookies = login.headers['set-cookie'] || [];
    expect(cookies.length).toBeGreaterThan(0);
    // Look for Secure flag
    const cookieStr = cookies.join('; ');
    expect(/Secure/i.test(cookieStr)).toBe(true);
  });
});
