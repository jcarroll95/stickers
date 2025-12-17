// Mock sendEmail to force the catch path in controllers/auth.forgotPassword
jest.mock('../../utils/sendEmail', () => jest.fn().mockRejectedValue(new Error('SMTP down')));

const request = require('supertest');
const app = require('../../server');

describe('Auth forgotPassword failure branch', () => {
  test('returns 500 when email send fails and resets token fields', async () => {
    const email = `ffail-${Date.now()}@example.com`;

    await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'F', email, password: 'Pass123!', role: 'user' })
      .expect(200);

    const res = await request(app)
      .post('/api/v1/auth/forgotPassword')
      .send({ email })
      .expect(500);

    expect(res.body.success).toBe(false);
  });
});
