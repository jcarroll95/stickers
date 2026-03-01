const request = require('supertest');
const app = require('../../server');
const GlobalStats = require('../../models/GlobalStats');
const User = require('../../models/User');

describe('Community Controller Coverage Boost', () => {
  let token;

  beforeAll(async () => {
    // Register and login to get token (since the route is protected by 'protect')
    const email = `community-test-${Date.now()}@example.com`;
    await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Tester', email, password: 'Password123!' });

    await User.updateOne({ email }, { isVerified: true });

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: 'Password123!' });

    token = loginRes.body.token;
  });

  beforeEach(async () => {
    await GlobalStats.deleteMany({});
  });

  test('GET /api/v1/community/stats - creates default stats if none exist (branch coverage)', async () => {
    // 1. Ensure no stats exist
    const count = await GlobalStats.countDocuments();
    expect(count).toBe(0);

    // 2. Request stats (hits the if (!stats) branch)
    const res = await request(app)
      .get('/api/v1/community/stats')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.totalCommunityMomentum).toBe(0);
    expect(res.body.data.totalWeightLost).toBe(0);

    // 3. Verify it was created in DB
    const stats = await GlobalStats.findOne();
    expect(stats).toBeDefined();
  });

  test('GET /api/v1/community/stats - returns existing stats', async () => {
    // 1. Manually create stats
    await GlobalStats.create({
      totalCommunityMomentum: 500,
      totalWeightLost: 25.5,
      lastUpdated: new Date()
    });

    // 2. Request stats (skips the if (!stats) branch)
    const res = await request(app)
      .get('/api/v1/community/stats')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);

    expect(res.body.success).toBe(true);
    expect(res.body.data.totalCommunityMomentum).toBe(500);
    expect(res.body.data.totalWeightLost).toBe(25.5);
  });
});
