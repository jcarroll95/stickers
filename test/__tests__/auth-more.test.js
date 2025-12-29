const request = require('supertest');
const app = require('../../server');
const User = require('../../models/User');

async function register({ name = 'User', email, password = 'Pass123!' , role = 'user'}) {
  return request(app)
    .post('/api/v1/auth/register')
    .send({ name, email, password, role })
    .expect(200);
}

describe('Auth controller additional branches', () => {
  test('login missing fields → 400', async () => {
    await request(app).post('/api/v1/auth/login').send({ email: 'x@x.com' }).expect(400);
    await request(app).post('/api/v1/auth/login').send({ password: 'Pass123!' }).expect(400);
  });

  test('login unknown email → 401', async () => {
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'no@no.com', password: 'Pass123!' })
      .expect(401);
  });

  test('login wrong password → 401', async () => {
    const email = 'wrongpass@example.com';
    await register({ name: 'Wrong', email });
    // mark verified so login path proceeds beyond verification check
    await User.updateOne({ email }, { isVerified: true });
    await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'Wrong!' })
      .expect(401);
  });

  test('forgotPassword with unknown email → 404 and with known email → 200', async () => {
    await request(app)
      .post('/api/v1/auth/forgotPassword')
      .send({ email: 'none@example.com' })
      .expect(404);

    const email = 'fp@example.com';
    await register({ name: 'FP', email });
    await request(app)
      .post('/api/v1/auth/forgotPassword')
      .send({ email })
      .expect(200);
  });

  test('resetPassword invalid token → 400', async () => {
    await request(app)
      .put('/api/v1/auth/resetpassword/not-a-valid-token')
      .send({ password: 'NewPass123!' })
      .expect(400);
  });

  test('resetPassword success path after generating a token → 200', async () => {
    const email = 'resetme@example.com';
    await register({ name: 'Reset', email });
    // Generate a reset token on the user directly
    const user = await User.findOne({ email });
    const rawToken = user.getResetPasswordToken();
    await user.save({ validateBeforeSave: false });

    await request(app)
      .put(`/api/v1/auth/resetpassword/${rawToken}`)
      .send({ password: 'BrandNew123!' })
      .expect(200);
  });

  test('updateDetails happy path (200) and logout (200)', async () => {
    const email = 'details@example.com';
    const password = 'Pass123!';
    await register({ name: 'Details', email, password });
    // verify before login
    await User.updateOne({ email }, { isVerified: true });
    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password })
      .expect(200);

    const token = login.body.token;

    const upd = await request(app)
      .put('/api/v1/auth/updatedetails')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'New Name', email: 'new-details@example.com' })
      .expect(200);

    expect(upd.body.success).toBe(true);
    expect(upd.body.data.name).toBe('New Name');

    await request(app).get('/api/v1/auth/logout').set('Authorization', `Bearer ${token}`).expect(200);
  });
});
