const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server');
const { registerVerifyLogin, authHeader } = require('./authHelpers');

describe('Stickerboard 404 branches for update/delete', () => {
  test('PUT /api/v1/stickerboards/:id 404 when not found', async () => {
    const { token } = await registerVerifyLogin({ email: `sb404u-${Date.now()}@ex.com` });
    const id = new mongoose.Types.ObjectId().toHexString();
    await request(app)
      .put(`/api/v1/stickerboards/${id}`)
      .set(authHeader(token))
      .send({ description: 'nope' })
      .expect(404);
  });

  test('DELETE /api/v1/stickerboards/:id 404 when not found', async () => {
    const { token } = await registerVerifyLogin({ email: `sb404d-${Date.now()}@ex.com` });
    const id = new mongoose.Types.ObjectId().toHexString();
    await request(app)
      .delete(`/api/v1/stickerboards/${id}`)
      .set(authHeader(token))
      .expect(404);
  });
});
