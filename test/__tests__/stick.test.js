const request = require('supertest');
const app = require('../../server');

async function registerAndLogin({ name = 'User', email, password = 'Pass123!', role = 'user' } = {}) {
  const reg = await request(app).post('/api/v1/auth/register').send({ name, email, password, role }).expect(200);
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

describe('Stick controller basic flows', () => {
  test('owner can add a stick and then update it (200)', async () => {
    const token = await registerAndLogin({ email: 'stickowner@example.com' });
    const board = await createBoard(token, { name: `SB-${Date.now()}`, description: 'desc' });

    // Add a stick to this board
    const createdStick = await request(app)
      .post(`/api/v1/stickerboards/${board._id}/stix`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        stickLocation: 'Arm',
        stickLocMod: 'Left',
        description: 'First stick',
        stickDose: 2.5
      })
      .expect(200);

    expect(createdStick.body.success).toBe(true);
    const stickId = createdStick.body.data._id;

    // Update the stick
    const updated = await request(app)
      .put(`/api/v1/stix/${stickId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ description: 'Updated stick' })
      .expect(200);

    expect(updated.body.success).toBe(true);
    expect(updated.body.data.description).toBe('Updated stick');
  });

  test('non-owner cannot update a stick (401)', async () => {
    const ownerToken = await registerAndLogin({ email: 'stickowner2@example.com' });
    const intruderToken = await registerAndLogin({ email: 'stickintruder@example.com' });
    const board = await createBoard(ownerToken, { name: `SB2-${Date.now()}`, description: 'desc' });

    const createdStick = await request(app)
      .post(`/api/v1/stickerboards/${board._id}/stix`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        stickLocation: 'Arm',
        stickLocMod: 'Right',
        description: 'Owner stick'
      })
      .expect(200);
    const stickId = createdStick.body.data._id;

    await request(app)
      .put(`/api/v1/stix/${stickId}`)
      .set('Authorization', `Bearer ${intruderToken}`)
      .send({ description: 'malicious' })
      .expect(401);
  });

  test('getStick returns 404 for non-existent id', async () => {
    const nonId = '65aa2dc3b3a2c1a7e5f4a9b1'; // valid-like hex but not in DB
    await request(app).get(`/api/v1/stix/${nonId}`).expect(404);
  });
});
