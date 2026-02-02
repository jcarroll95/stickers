const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server');
const { registerVerifyLogin, authHeader } = require('./authHelpers');
const { createBoard } = require('./boardHelpers');

describe('Stickerboard controller additional coverage', () => {
  test('GET /:id non-existent returns 404', async () => {
    const id = new mongoose.Types.ObjectId();
    await request(app).get(`/api/v1/stickerboards/${id}`).expect(404);
  });

  test('unauthorized update and delete by non-owner → 401', async () => {
    const { token: ownerToken } = await registerVerifyLogin({ email: 'owner1@example.com' });
    const { token: intruderToken } = await registerVerifyLogin({ email: 'intruder1@example.com' });

    const { boardId } = await createBoard({
      token: ownerToken,
      name: 'Private Board',
      description: 'Owned by User A'
    });

    await request(app)
      .put(`/api/v1/stickerboards/${boardId}`)
      .set(authHeader(intruderToken))
      .send({ description: 'hacked' })
      .expect(401);

    await request(app)
      .delete(`/api/v1/stickerboards/${boardId}`)
      .set(authHeader(intruderToken))
      .expect(401);
  });

  test('advancedResults branches: select/sort/pagination', async () => {
    // vipuser can create multiple boards
    const { token } = await registerVerifyLogin({ email: 'query@example.com', role: 'vipuser' });

    // Seed some boards
    for (let i = 0; i < 3; i++) {
      await createBoard({
        token,
        name: `Board${i}-${Date.now()}`,
        description: 'desc'
      });
    }

    const res = await request(app)
      .get('/api/v1/stickerboards?select=name,description&sort=name&page=1&limit=1')
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(1);
  });

  test('photo upload route without file returns 400 (authorized vipuser)', async () => {
    const { token } = await registerVerifyLogin({ email: 'vipu@example.com', role: 'vipuser' });
    const { boardId } = await createBoard({
      token,
      name: `PhotoBoard-${Date.now()}`,
      description: 'desc'
    });

    await request(app)
      .put(`/api/v1/stickerboards/${boardId}/photo`)
      .set(authHeader(token))
      .expect(400);
  });
});
