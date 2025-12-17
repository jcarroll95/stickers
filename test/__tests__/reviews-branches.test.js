const request = require('supertest');
const app = require('../../server');

async function registerAndLogin({ name = 'User', email, password = 'Pass123!', role = 'user' } = {}) {
  await request(app).post('/api/v1/auth/register').send({ name, email, password, role }).expect(200);
  const login = await request(app).post('/api/v1/auth/login').send({ email, password }).expect(200);
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

describe('Reviews additional branches', () => {
  test('global GET /api/v1/reviews returns advancedResults structure', async () => {
    const token = await registerAndLogin({ email: `rev-global-${Date.now()}@ex.com` });
    const board = await createBoard(token, { name: `RB-global-${Date.now()}`, description: 'desc' });

    await request(app)
      .post(`/api/v1/stickerboards/${board._id}/reviews`)
      .set('Authorization', `Bearer ${token}`)
      .send({ comment: 'Ok', reviewRating: 4 })
      .expect(201);

    const res = await request(app).get('/api/v1/reviews').expect(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(typeof res.body.count).toBe('number');
  });

  test('deleteReview by non-owner returns 401', async () => {
    const ownerToken = await registerAndLogin({ email: `rev-owner-${Date.now()}@ex.com` });
    const intruderToken = await registerAndLogin({ email: `rev-intr-${Date.now()}@ex.com` });
    const board = await createBoard(ownerToken, { name: `RB-no-${Date.now()}`, description: 'desc' });

    const created = await request(app)
      .post(`/api/v1/stickerboards/${board._id}/reviews`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ comment: 'Mine', reviewRating: 5 })
      .expect(201);
    const reviewId = created.body.data._id;

    await request(app)
      .delete(`/api/v1/reviews/${reviewId}`)
      .set('Authorization', `Bearer ${intruderToken}`)
      .expect(401);
  });
});
