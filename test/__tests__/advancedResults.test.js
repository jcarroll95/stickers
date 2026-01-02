const express = require('express');
const request = require('supertest');
const advancedResults = require('../../middleware/advancedResults');
const Stickerboard = require('../../models/Stickerboard');
const appServer = require('../../server');

// We'll build a tiny express app that mounts advancedResults explicitly for unit-ish coverage
function buildApp(model, populate) {
  const app = express();
  app.get('/items', advancedResults(model, populate), (req, res) => {
    res.status(200).json(res.advancedResults);
  });
  return app;
}

async function createBoard({ name, description, userToken }) {
  const res = await request(appServer)
    .post('/api/v1/stickerboards')
    .set('Authorization', `Bearer ${userToken}`)
    .send({ name, description })
    .expect(201);
  return res.body.data;
}

async function registerAndLogin({ name = 'User', email, password = 'Pass123!', role = 'vipuser' } = {}) {
  const reg = await request(appServer).post('/api/v1/auth/register').send({ name, email, password, role }).expect(200);
  return reg.body.token;
}

describe('middleware/advancedResults unit coverage', () => {
  test('select, sort default, pagination next/prev, and populate branches are exercised', async () => {
    const token = await registerAndLogin({ email: 'adv@example.com' });
    // Seed multiple boards
    const names = ['Alpha', 'Bravo', 'Charlie'];
    for (const n of names) {
      await createBoard({ name: `${n}-${Date.now()}`, description: 'desc', userToken: token });
    }

    const app = buildApp(Stickerboard, 'stix');

    // Page 1, limit 1, select some fields
    const page1 = await request(app)
      .get('/items?select=name,description&limit=1&page=1')
      .expect(200);
    expect(page1.body.success).toBe(true);
    expect(Array.isArray(page1.body.data)).toBe(true);
    expect(page1.body.data.length).toBe(1);

    // Page 2 to trigger prev/next calculations as well
    const page2 = await request(app)
      .get('/items?select=name,description&limit=1&page=2&sort=name')
      .expect(200);
    expect(page2.body.success).toBe(true);
    expect(page2.body.data.length).toBe(1);
  });

  test('should support [ne] operator', async () => {
    const token = await registerAndLogin({ email: 'ne@example.com' });
    const user1 = '695737819754e2dcb92cfe39'; // From logs above, but better to be dynamic if possible
    // Actually, let's just use what was seeded or seed new ones.
    
    const board1 = await createBoard({ name: 'Board1', description: 'desc', userToken: token });
    const userId = board1.user;

    const app = buildApp(Stickerboard);
    
    // Fetch with [ne]
    const res = await request(app)
      .get(`/items?user[ne]=${userId}`)
      .expect(200);
    
    expect(res.body.success).toBe(true);
    // All returned boards should NOT have this userId
    res.body.data.forEach(board => {
      expect(board.user.toString()).not.toBe(userId.toString());
    });
  });
});
