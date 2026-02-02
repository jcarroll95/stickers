const request = require('supertest');
const app = require('../../server');
const { registerVerifyLogin, authHeader } = require('./authHelpers');
const { createBoard } = require('./boardHelpers');

describe('Stickerboard owner success paths', () => {
  test('owner can update and delete their stickerboard', async () => {
    const { token } = await registerVerifyLogin({ email: 'owner-success@example.com' });

    const { boardId } = await createBoard({
      token,
      name: `OS-${Date.now()}`,
      description: 'first'
    });

    const updated = await request(app)
      .put(`/api/v1/stickerboards/${boardId}`)
      .set(authHeader(token))
      .send({ description: 'changed' })
      .expect(200);
    expect(updated.body.success).toBe(true);
    expect(updated.body.data.description).toBe('changed');

    const deleted = await request(app)
      .delete(`/api/v1/stickerboards/${boardId}`)
      .set(authHeader(token))
      .expect(200);
    expect(deleted.body.success).toBe(true);
    expect(deleted.body.data).toEqual({});
  });
});
