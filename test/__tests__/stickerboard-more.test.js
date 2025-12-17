const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server');

async function registerAndLogin({ name = 'User', email, password = 'Pass123!', role = 'user' } = {}) {
  await request(app)
    .post('/api/v1/auth/register')
    .send({ name, email, password, role })
    .expect(200);
  const login = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password })
    .expect(200);
  return login.body.token;
}

describe('Stickerboard controller additional coverage', () => {
  test('GET /:id non-existent returns 404', async () => {
    const id = new mongoose.Types.ObjectId();
    await request(app).get(`/api/v1/stickerboards/${id}`).expect(404);
  });

  test('unauthorized update and delete by non-owner → 401', async () => {
    const ownerToken = await registerAndLogin({ email: 'owner1@example.com' });
    const intruderToken = await registerAndLogin({ email: 'intruder1@example.com' });

    const created = await request(app)
      .post('/api/v1/stickerboards')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ name: 'Private Board', description: 'Owned by User A' })
      .expect(201);
    const id = created.body.data._id;

    await request(app)
      .put(`/api/v1/stickerboards/${id}`)
      .set('Authorization', `Bearer ${intruderToken}`)
      .send({ description: 'hacked' })
      .expect(401);

    await request(app)
      .delete(`/api/v1/stickerboards/${id}`)
      .set('Authorization', `Bearer ${intruderToken}`)
      .expect(401);
  });

  test('advancedResults branches: select/sort/pagination', async () => {
    // vipuser can create multiple boards
    const token = await registerAndLogin({ email: 'query@example.com', role: 'vipuser' });

    // Seed some boards
    for (let i = 0; i < 3; i++) {
      await request(app)
        .post('/api/v1/stickerboards')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: `Board${i}-${Date.now()}`, description: 'desc' })
        .expect(201);
    }

    const res = await request(app)
      .get('/api/v1/stickerboards?select=name,description&sort=name&page=1&limit=1')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(1);
  });

  test('photo upload route without file returns 400 (authorized vipuser)', async () => {
    const token = await registerAndLogin({ email: 'vipu@example.com', role: 'vipuser' });
    const created = await request(app)
      .post('/api/v1/stickerboards')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `PhotoBoard-${Date.now()}`, description: 'desc' })
      .expect(201);
    const id = created.body.data._id;

    await request(app)
      .put(`/api/v1/stickerboards/${id}/photo`)
      .set('Authorization', `Bearer ${token}`)
      .expect(400);
  });
});
