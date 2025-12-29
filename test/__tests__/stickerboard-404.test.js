const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server');

async function registerAndLogin({ email }) {
  const reg = await request(app).post('/api/v1/auth/register').send({ name: 'SB404', email, password: 'Pass123!', role: 'user' }).expect(200);
  return reg.body.token;
}

describe('Stickerboard 404 branches for update/delete', () => {
  test('PUT /api/v1/stickerboards/:id 404 when not found', async () => {
    const token = await registerAndLogin({ email: `sb404u-${Date.now()}@ex.com` });
    const id = new mongoose.Types.ObjectId().toHexString();
    await request(app)
      .put(`/api/v1/stickerboards/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'nope' })
      .expect(404);
  });

  test('DELETE /api/v1/stickerboards/:id 404 when not found', async () => {
    const token = await registerAndLogin({ email: `sb404d-${Date.now()}@ex.com` });
    const id = new mongoose.Types.ObjectId().toHexString();
    await request(app)
      .delete(`/api/v1/stickerboards/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });
});
