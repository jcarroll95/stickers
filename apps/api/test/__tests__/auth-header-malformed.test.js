const request = require('supertest');
const app = require('../../server');

describe('protect middleware with malformed Authorization header', () => {
  test('Authorization without Bearer prefix is rejected (401)', async () => {
    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Token abc.def.ghi')
      .expect(401);
    expect(res.body.success).toBe(false);
  });
});
