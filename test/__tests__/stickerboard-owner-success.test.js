const request = require('supertest');
const app = require('../../server');

async function registerAndLogin({ name = 'User', email, password = 'Pass123!', role = 'user' } = {}) {
  await request(app).post('/api/v1/auth/register').send({ name, email, password, role }).expect(200);
  const login = await request(app).post('/api/v1/auth/login').send({ email, password }).expect(200);
  return login.body.token;
}

describe('Stickerboard owner success paths', () => {
  test('owner can update and delete their stickerboard', async () => {
    const token = await registerAndLogin({ email: 'owner-success@example.com' });

    const created = await request(app)
      .post('/api/v1/stickerboards')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `OS-${Date.now()}`, description: 'first' })
      .expect(201);
    const id = created.body.data._id;

    const updated = await request(app)
      .put(`/api/v1/stickerboards/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'changed' })
      .expect(200);
    expect(updated.body.success).toBe(true);
    expect(updated.body.data.description).toBe('changed');

    const deleted = await request(app)
      .delete(`/api/v1/stickerboards/${id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(deleted.body.success).toBe(true);
    expect(deleted.body.data).toEqual({});
  });
});
