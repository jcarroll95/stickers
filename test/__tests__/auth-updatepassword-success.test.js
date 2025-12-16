const request = require('supertest');
const app = require('../../server');

describe('Auth updatePassword success path', () => {
  test('updates password when currentPassword is correct (200)', async () => {
    const email = 'updpass.success@example.com';
    const oldPass = 'Pass123!';
    const newPass = 'NewPass123!';

    // Register
    await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'UP', email, password: oldPass, role: 'user' })
      .expect(200);

    // Login
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: oldPass })
      .expect(200);

    const token = login.body.token;

    // Update password
    const upd = await request(app)
      .put('/api/v1/auth/updatepassword')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: oldPass, newPassword: newPass })
      .expect(200);

    expect(upd.body.success).toBe(true);
    expect(upd.body.token).toBeDefined();

    // Login with new password should succeed
    const login2 = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: newPass })
      .expect(200);

    expect(login2.body.success).toBe(true);
  });
});
