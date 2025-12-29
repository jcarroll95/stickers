const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server');

describe('Stick delete: non-existent id returns 404', () => {
  test('DELETE /api/v1/stix/:id 404 when not found', async () => {
    const fakeId = new mongoose.Types.ObjectId().toHexString();
    // Need to be authenticated because route is protected; create a quick user/token
    const email = `sd404-${Date.now()}@ex.com`;
    const reg = await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'X', email, password: 'Pass123!', role: 'user' })
      .expect(200);
    const token = reg.body.token;

    await request(app)
      .delete(`/api/v1/stix/${fakeId}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
  });
});
