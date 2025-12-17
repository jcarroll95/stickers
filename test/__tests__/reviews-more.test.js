const request = require('supertest');
const mongoose = require('mongoose');
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

describe('Reviews controller additional flows', () => {
  test('getReview returns 404 for non-existent valid ObjectId', async () => {
    const vid = new mongoose.Types.ObjectId().toHexString();
    await request(app).get(`/api/v1/reviews/${vid}`).expect(404);
  });

  test('getReview success, updateReview success by owner, deleteReview success by owner', async () => {
    const token = await registerAndLogin({ email: 'reviews-more@example.com' });
    const board = await createBoard(token, { name: `RB-${Date.now()}`, description: 'desc' });

    // create review
    const created = await request(app)
      .post(`/api/v1/stickerboards/${board._id}/reviews`)
      .set('Authorization', `Bearer ${token}`)
      .send({ comment: 'Good', reviewRating: 5 })
      .expect(201);
    const reviewId = created.body.data._id;

    // getReview success
    const got = await request(app).get(`/api/v1/reviews/${reviewId}`).expect(200);
    expect(got.body.success).toBe(true);
    expect(got.body.data._id).toBe(reviewId);

    // updateReview success by owner
    const upd = await request(app)
      .put(`/api/v1/reviews/${reviewId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ comment: 'Great!' })
      .expect(200);
    expect(upd.body.data.comment).toBe('Great!');

    // deleteReview success by owner
    const del = await request(app)
      .delete(`/api/v1/reviews/${reviewId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(del.body.success).toBe(true);
    expect(del.body.data).toEqual({});
  });
});
