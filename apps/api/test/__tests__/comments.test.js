const request = require('supertest');
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

describe('Comments controller', () => {
  test('add comment and list nested comments for a board', async () => {
    const token = await registerAndLogin({ email: 'commenter@example.com' });
    const board = await createBoard(token, { name: `Board-C-${Date.now()}`, description: 'desc' });

    await request(app)
      .post(`/api/v1/stickerboards/${board._id}/comments`)
      .set('Authorization', `Bearer ${token}`)
      .send({ comment: 'Nice board', commentRating: 5 })
      .expect(201);

    const list = await request(app)
      .get(`/api/v1/stickerboards/${board._id}/comments`)
      .expect(200);

    expect(list.body.success).toBe(true);
    expect(list.body.count).toBe(1);
    expect(Array.isArray(list.body.data)).toBe(true);
    expect(list.body.data[0].comment).toBe('Nice board');
  });

  test('non-owner cannot update another user\'s comment (401)', async () => {
    const ownerToken = await registerAndLogin({ email: 'commentowner@example.com' });
    const intruderToken = await registerAndLogin({ email: 'commentintruder@example.com' });
    const board = await createBoard(ownerToken, { name: `Board-C2-${Date.now()}`, description: 'desc' });

    const created = await request(app)
      .post(`/api/v1/stickerboards/${board._id}/comments`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ comment: 'Owner comment', commentRating: 4 })
      .expect(201);
    const commentId = created.body.data._id;

    await request(app)
      .put(`/api/v1/comments/${commentId}`)
      .set('Authorization', `Bearer ${intruderToken}`)
      .send({ comment: 'Hacked' })
      .expect(401);
  });
});
