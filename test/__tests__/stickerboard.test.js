const request = require('supertest');
const app = require('../../server');

async function registerAndLogin({ name = 'Bob', email, password = 'Pass123!' } = {}) {
  // New flow: registration returns a JWT token; login requires email verification now.
  const reg = await request(app)
    .post('/api/v1/auth/register')
    .send({ name, email, password, role: 'user' })
    .expect(200);

  return reg.body.token;
}

describe('Stickerboard routes', () => {
  test('create stickerboard then list returns it', async () => {
    const email = 'bob@example.com';
    const token = await registerAndLogin({ email });

    // create
    const created = await request(app)
      .post('/api/v1/stickerboards')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Steps Challenge', description: 'Walk daily' })
      .expect(201);

    expect(created.body.success).toBe(true);
    expect(created.body.data).toBeDefined();
    expect(created.body.data.name).toBe('Steps Challenge');

    // list
    const list = await request(app)
      .get('/api/v1/stickerboards')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(list.body.success).toBe(true);
    expect(Array.isArray(list.body.data)).toBe(true);
    expect(list.body.data.find(b => b.name === 'Steps Challenge')).toBeTruthy();
  });

  test('non-vip user cannot create a second stickerboard (400)', async () => {
    const email = 'carol@example.com';
    const token = await registerAndLogin({ name: 'Carol', email });

    // first create ok
    await request(app)
      .post('/api/v1/stickerboards')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Board One', description: 'First' })
      .expect(201);

    // second create should fail for regular user
    const res = await request(app)
      .post('/api/v1/stickerboards')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Board Two', description: 'Second' })
      .expect(400);

    expect(res.body.success).toBe(false);
  });
});
