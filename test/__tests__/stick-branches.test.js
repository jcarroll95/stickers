const request = require('supertest');
const mongoose = require('mongoose');
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

describe('Stick controller branch coverage', () => {
  test('addStick by non-owner is 401', async () => {
    const ownerToken = await registerAndLogin({ email: 'stick-branch-owner@example.com' });
    const intruderToken = await registerAndLogin({ email: 'stick-branch-intruder@example.com' });
    const board = await createBoard(ownerToken, { name: `SB-branch-${Date.now()}`, description: 'desc' });

    await request(app)
      .post(`/api/v1/stickerboards/${board._id}/stix`)
      .set('Authorization', `Bearer ${intruderToken}`)
      .send({ stickLocation: 'Arm', stickLocMod: 'Left', description: 'x' })
      .expect(401);
  });

  test('addStick with non-existent board id returns 404', async () => {
    const token = await registerAndLogin({ email: 'stick-branch-404@example.com' });
    const fakeId = new mongoose.Types.ObjectId().toHexString();

    await request(app)
      .post(`/api/v1/stickerboards/${fakeId}/stix`)
      .set('Authorization', `Bearer ${token}`)
      .send({ stickLocation: 'Arm', stickLocMod: 'Right', description: 'y' })
      .expect(404);
  });
});
