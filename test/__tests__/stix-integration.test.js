const request = require('supertest');
const app = require('../../server');
const Stickerboard = require('../../models/Stickerboard');
const User = require('../../models/User');

describe('Stix Integration', () => {
  const email = 'test@example.com';
  const password = 'Password123!';
  let token;

  beforeAll(async () => {
    // 1. Setup user & board
    await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Test User', email, password });
    
    // Mark user as verified
    await User.updateOne({ email }, { isVerified: true });

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password });
    
    token = loginRes.body.token;
  });

  test('Creating a Stick entry adds a sticker to the Stickerboard palette', async () => {
    const boardRes = await request(app)
      .post('/api/v1/stickerboards')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'My Board', description: 'Test description' });
    const boardId = boardRes.body.data._id;

    // 2. Add a Stick
    await request(app)
      .post(`/api/v1/stix/${boardId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        stickDose: 2.5,
        stickLocation: 'Stomach',
        stickLocMod: 'Left',
        description: 'First shot'
      })
      .expect(200);

    // 3. Verify side effect on Stickerboard
    const updatedBoard = await Stickerboard.findById(boardId);
    expect(updatedBoard.stickers.length).toBe(1);
    expect(updatedBoard.stickers[0].stuck).toBe(false);
    expect(updatedBoard.stickers[0].stickerId).toBeDefined();
  });

  test('Subsequent Stick entries receive incrementing sticker IDs based on stickNumber', async () => {
    // 1. Setup another user to avoid "only one board" restriction
    const otherEmail = 'test2@example.com';
    await request(app)
      .post('/api/v1/auth/register')
      .send({ name: 'Test User 2', email: otherEmail, password });
    await User.updateOne({ email: otherEmail }, { isVerified: true });
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: otherEmail, password });
    const otherToken = loginRes.body.token;

    const boardRes = await request(app)
      .post('/api/v1/stickerboards')
      .set('Authorization', `Bearer ${otherToken}`)
      .send({ name: 'Another Board', description: 'Test description' });
    const boardId = boardRes.body.data._id;

    // Add first stick with number 1
    await request(app)
      .post(`/api/v1/stix/${boardId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({
        stickNumber: 1,
        stickLocation: 'Stomach',
        stickLocMod: 'Left',
        description: 'Shot 1'
      });

    // Add second stick with number 12 (should result in stickerId 2)
    await request(app)
      .post(`/api/v1/stix/${boardId}`)
      .set('Authorization', `Bearer ${otherToken}`)
      .send({
        stickNumber: 12,
        stickLocation: 'Stomach',
        stickLocMod: 'Right',
        description: 'Shot 12'
      });

    const updatedBoard = await Stickerboard.findById(boardId);
    expect(updatedBoard.stickers.length).toBe(2);
    // stickerId should be stickNumber % 10
    expect(updatedBoard.stickers[0].stickerId).toBe(1);
    expect(updatedBoard.stickers[1].stickerId).toBe(2);
  });
});
