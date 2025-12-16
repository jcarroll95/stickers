const request = require('supertest');
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

async function createBoard(token, { name, description } = {}) {
  const res = await request(app)
    .post('/api/v1/stickerboards')
    .set('Authorization', `Bearer ${token}`)
    .send({ name, description })
    .expect(201);
  return res.body.data;
}

describe('Reviews controller', () => {
  test('add review and list nested reviews for a board', async () => {
    const token = await registerAndLogin({ email: 'reviewer@example.com' });
    const board = await createBoard(token, { name: `Board-R-${Date.now()}`, description: 'desc' });

    await request(app)
      .post(`/api/v1/stickerboards/${board._id}/reviews`)
      .set('Authorization', `Bearer ${token}`)
      .send({ comment: 'Nice board', reviewRating: 5 })
      .expect(201);

    const list = await request(app)
      .get(`/api/v1/stickerboards/${board._id}/reviews`)
      .expect(200);

    expect(list.body.success).toBe(true);
    expect(list.body.count).toBe(1);
    expect(Array.isArray(list.body.data)).toBe(true);
    expect(list.body.data[0].comment).toBe('Nice board');
  });

  test('non-owner cannot update another user\'s review (401)', async () => {
    const ownerToken = await registerAndLogin({ email: 'reviewowner@example.com' });
    const intruderToken = await registerAndLogin({ email: 'reviewintruder@example.com' });
    const board = await createBoard(ownerToken, { name: `Board-R2-${Date.now()}`, description: 'desc' });

    const created = await request(app)
      .post(`/api/v1/stickerboards/${board._id}/reviews`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ comment: 'Owner review', reviewRating: 4 })
      .expect(201);
    const reviewId = created.body.data._id;

    await request(app)
      .put(`/api/v1/reviews/${reviewId}`)
      .set('Authorization', `Bearer ${intruderToken}`)
      .send({ comment: 'Hacked' })
      .expect(401);
  });
});
