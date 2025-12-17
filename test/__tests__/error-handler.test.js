const request = require('supertest');
const app = require('../../server');

async function registerAndLogin({ name = 'User', email, password = 'Pass123!', role = 'vipuser' } = {}) {
  await request(app).post('/api/v1/auth/register').send({ name, email, password, role }).expect(200);
  const login = await request(app).post('/api/v1/auth/login').send({ email, password }).expect(200);
  return login.body.token;
}

async function createBoard(token, { name, description } = {}) {
  const res = await request(app)
    .post('/api/v1/stickerboards')
    .set('Authorization', `Bearer ${token}`)
    .send({ name, description })
    .expect(201);
  return res.body.data;
}

describe('Global error handler branches', () => {
  test('CastError → 404 on invalid ObjectId', async () => {
    const invalid = 'not-a-valid-objectid';
    const res = await request(app).get(`/api/v1/stickerboards/${invalid}`).expect(404);
    expect(res.body.success).toBe(false);
    expect(String(res.body.error || '')).toMatch(/resource not found/i);
  });

  test('Duplicate key error → 400 when creating two boards with same name', async () => {
    const token = await registerAndLogin({ email: 'dup@example.com' });
    const name = `Dup-${Date.now()}`;
    await createBoard(token, { name, description: 'one' });
    const res = await request(app)
      .post('/api/v1/stickerboards')
      .set('Authorization', `Bearer ${token}`)
      .send({ name, description: 'duplicate' })
      .expect(400);
    expect(res.body.success).toBe(false);
    expect(String(res.body.error || '')).toMatch(/duplicate field value/i);
  });

  test('ValidationError → 400 when creating Stick missing required fields', async () => {
    const token = await registerAndLogin({ email: 'val@example.com' });
    const board = await createBoard(token, { name: `V-${Date.now()}`, description: 'desc' });
    const res = await request(app)
      .post(`/api/v1/stickerboards/${board._id}/stix`)
      .set('Authorization', `Bearer ${token}`)
      // omit stickLocation and description to trigger validation
      .send({ stickLocMod: 'Left' })
      .expect(400);
    expect(res.body.success).toBe(false);
    expect(String(res.body.error || '')).toMatch(/please/i);
  });
});
