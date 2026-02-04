const request = require('supertest');
const app = require('../../server');
const { registerVerifyLogin, authHeader } = require('./authHelpers');
const { createBoard } = require('./boardHelpers');

describe('Stick controller additional coverage', () => {
  test('nested GET stix for a board returns created item', async () => {
    const { token } = await registerVerifyLogin({ email: 'stick-more@example.com' });
    const { boardId } = await createBoard({
      token,
      name: `SB-more-${Date.now()}`,
      description: 'desc'
    });

    // create one stick
    await request(app)
      .post(`/api/v1/stickerboards/${boardId}/stix`)
      .set(authHeader(token))
      .send({ stickLocation: 'Arm', stickLocMod: 'Left', description: 'A', stickDose: 2.5 })
      .expect(200);

    const list = await request(app)
      .get(`/api/v1/stickerboards/${boardId}/stix`)
      .expect(200);

    expect(list.body.success).toBe(true);
    expect(list.body.count).toBe(1);
    expect(Array.isArray(list.body.data)).toBe(true);
  });

  test('global GET /api/v1/stix (advancedResults path) returns array', async () => {
    const { token } = await registerVerifyLogin({ email: 'stick-list@example.com' });
    const { boardId } = await createBoard({
      token,
      name: `SB-list-${Date.now()}`,
      description: 'desc'
    });

    // seed a couple of sticks
    for (const mod of ['Left', 'Right']) {
      await request(app)
        .post(`/api/v1/stickerboards/${boardId}/stix`)
        .set(authHeader(token))
        .send({ stickLocation: 'Arm', stickLocMod: mod, description: `d-${mod}` })
        .expect(200);
    }

    const list = await request(app).get('/api/v1/stix').expect(200);
    expect(list.body.success).toBe(true);
    expect(Array.isArray(list.body.data)).toBe(true);
    expect(list.body.count >= 2).toBe(true);
  });
});
