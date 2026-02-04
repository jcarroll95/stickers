const request = require('supertest');
const app = require('../../server');
const { registerVerifyLogin, authHeader } = require('./authHelpers');
const { createBoard } = require('./boardHelpers');

describe('Stickerboard routes', () => {
  test('create stickerboard then list returns it', async () => {
    const email = 'bob@example.com';
    const { token } = await registerVerifyLogin({ name: 'Bob', email });

    // create
    const { board } = await createBoard({
      token,
      name: 'Steps Challenge',
      description: 'Walk daily'
    });

    expect(board).toBeDefined();
    expect(board.name).toBe('Steps Challenge');

    // list
    const list = await request(app)
      .get('/api/v1/stickerboards')
      .set(authHeader(token))
      .expect(200);

    expect(list.body.success).toBe(true);
    expect(Array.isArray(list.body.data)).toBe(true);
    expect(list.body.data.find(b => b.name === 'Steps Challenge')).toBeTruthy();
  });

  test('non-vip user cannot create a second stickerboard (400)', async () => {
    const email = 'carol@example.com';
    const { token } = await registerVerifyLogin({ name: 'Carol', email });

    // first create ok
    await createBoard({
      token,
      name: 'Board One',
      description: 'First'
    });

    // second create should fail for regular user
    const res = await request(app)
      .post('/api/v1/stickerboards')
      .set(authHeader(token))
      .send({ name: 'Board Two', description: 'Second' })
      .expect(400);

    expect(res.body.success).toBe(false);
  });
});
