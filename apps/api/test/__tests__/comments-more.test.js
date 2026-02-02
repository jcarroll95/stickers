const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server');

async function registerAndLogin({ name = 'User', email, password = 'Pass123!', role = 'user' } = {}) {
  const reg = await request(app)
    .post('/api/v1/auth/register')
    .send({ name, email, password, role })
    .expect(200);
  return reg.body.token;
}

async function createBoard(token, { name, description } = {}) {
  const res = await request(app)
    .post('/api/v1/stickerboards')
    .set('Authorization', `Bearer ${token}`)
    .send({ name, description })
    .expect(201);
  return res.body.data;
}

describe('Comments controller additional flows', () => {
  test('getComment returns 404 for non-existent valid ObjectId', async () => {
    const vid = new mongoose.Types.ObjectId().toHexString();
    await request(app).get(`/api/v1/comments/${vid}`).expect(404);
  });

  test('getComment success, updateComment success by owner, deleteComment success by owner', async () => {
    const token = await registerAndLogin({ email: 'comments-more@example.com' });
    const board = await createBoard(token, { name: `RB-${Date.now()}`, description: 'desc' });

    // create comment
    const created = await request(app)
      .post(`/api/v1/stickerboards/${board._id}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ comment: 'Good', commentRating: 5 })
      .expect(201);
    const commentId = created.body.data._id;

    // getComment success
    const got = await request(app).get(`/api/v1/comments/${commentId}`).expect(200);
    expect(got.body.success).toBe(true);
    expect(got.body.data._id).toBe(commentId);

    // updateComment success by owner
    const upd = await request(app)
      .put(`/api/v1/comments/${commentId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ comment: 'Great!' })
      .expect(200);
    expect(upd.body.data.comment).toBe('Great!');

    // deleteComment success by owner
    const del = await request(app)
      .delete(`/api/v1/comments/${commentId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(del.body.success).toBe(true);
    expect(del.body.data).toEqual({});
  });
});
