const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../server');
const User = require('../../models/User');

describe('protect middleware cookie token path', () => {
  test('allows access with valid JWT in cookie (no Authorization header)', async () => {
    // Create a user directly
    const user = await User.create({
      name: 'CookieUser',
      email: `cookieuser-${Date.now()}@example.com`,
      password: 'Pass123!',
      role: 'user'
    });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET);

    const res = await request(app)
      .get('/api/v1/auth/me')
      .set('Cookie', [`token=${token}`])
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.email).toBe(user.email);
  });
});
