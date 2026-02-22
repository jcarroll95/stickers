const request = require('supertest');
const app = require('../../server');
const mongoose = require('mongoose');
const User = require('../../models/User');
const Stickerboard = require('../../models/Stickerboard');
const { registerVerifyLogin, authHeader } = require('./authHelpers');
const { createBoard } = require('./boardHelpers');

describe('Stickerboard invariants', () => {
  test('Test 1 — Non-owner cannot update non-sticker fields', async () => {
    // Setup
    // User A registers/logs in; creates a board.
    const { token: tokenA } = await registerVerifyLogin({ email: 'owner@example.com' });
    const { boardId } = await createBoard({
      token: tokenA,
      name: 'Original Name',
      description: 'Original Description'
    });

    // User B registers/logs in.
    const { token: tokenB } = await registerVerifyLogin({ email: 'nonowner@example.com' });

    // Action
    // User B sends: PUT /api/v1/stickerboards/:id { name: "Hacked" }
    await request(app)
      .put(`/api/v1/stickerboards/${boardId}`)
      .set(authHeader(tokenB))
      .send({ name: 'Hacked!' })
      .expect(400);

    // Assertions
    // Fetch the board from DB and assert name unchanged
    const board = await Stickerboard.findById(boardId);
    expect(board.name).toBe('Original Name');
  });

  test('Test 2 — Non-owner cannot send multiple fields even if one is stickers', async () => {
    // Setup
    const { token: tokenA } = await registerVerifyLogin({ email: 'owner2@example.com' });
    const { boardId } = await createBoard({
      token: tokenA,
      name: 'Stable Name',
      description: 'Stable Description'
    });

    const { token: tokenB } = await registerVerifyLogin({ email: 'nonowner2@example.com' });

    // Action
    // User B sends: { stickers: [...], description: "nope" }
    // Note: description is NOT allowed for non-owners, and sending multiple fields
    // should trigger the 403 authorized check in the controller.
    await request(app)
      .put(`/api/v1/stickerboards/${boardId}`)
      .set(authHeader(tokenB))
      .send({
        stickers: [{ stickerId: 1, x: 10, y: 10 }],
        description: 'Hacked Description'
      })
      .expect(403);

    // Assertions
    // Board remains unchanged
    const board = await Stickerboard.findById(boardId);
    expect(board.description).toBe('Stable Description');
  });

  test('Test 3 — Non-owner using stickers array must append (length increases)', async () => {
    // Setup
    // Board initially has 0 stickers.
    const { token: tokenA } = await registerVerifyLogin({ email: 'owner3@example.com' });
    const { boardId } = await createBoard({
      token: tokenA,
      name: 'Append Only Board',
      description: 'Must append'
    });

    const { token: tokenB } = await registerVerifyLogin({ email: 'nonowner3@example.com' });

    // Action
    // User B sends: { stickers: [] } which is the same length as current (0)
    const res = await request(app)
      .put(`/api/v1/stickerboards/${boardId}`)
      .set(authHeader(tokenB))
      .send({ stickers: [] })
      .expect(400);

    // Assertions
    // HTTP 400 “must append a sticker”
    expect(res.body.error).toMatch(/must append a sticker/i);

    // Board unchanged (still 0 stickers)
    const board = await Stickerboard.findById(boardId);
    expect(board.stickers.length).toBe(0);
  });

  test('Test 4 — Non-owner cannot use invalid sticker payload (shape validation)', async () => {
    // Setup
    const { token: tokenA } = await registerVerifyLogin({ email: 'owner4@example.com' });
    const { boardId } = await createBoard({
      token: tokenA,
      name: 'Validation Board',
      description: 'Validation'
    });

    const emailB = 'nonowner4@example.com';
    const { token: tokenB } = await registerVerifyLogin({ email: emailB });

    // Action
    // Using sticker object form with invalid stickerId (string "abc")
    // Controller buildCheersSticker will fail to parse "abc" as a finite number
    const res = await request(app)
      .put(`/api/v1/stickerboards/${boardId}`)
      .set(authHeader(tokenB))
      .send({
        sticker: { stickerId: 'abc', x: 1, y: 1 }
      })
      .expect(400);

    // Assertions
    // HTTP 400 “Invalid sticker seed-data provided”
    expect(res.body.error).toMatch(/Invalid sticker data provided/i);

    // Board unchanged
    const board = await Stickerboard.findById(boardId);
    expect(board.stickers.length).toBe(0);

    // User B cheersStickers unchanged
    const userB = await User.findOne({ email: emailB });
    // Default cheersStickers are [0, 1, 2, 3, 4]
    expect(userB.cheersStickers).toEqual([0, 1, 2, 3, 4]);
  });

  test('Test 5 — Non-owner cannot add sticker they do not own', async () => {
    // Setup
    const { token: tokenA } = await registerVerifyLogin({ email: 'owner5@example.com' });
    const { boardId } = await createBoard({
      token: tokenA,
      name: 'Ownership Test Board',
      description: 'Ownership'
    });

    const emailB = 'nonowner5@example.com';
    const { token: tokenB } = await registerVerifyLogin({ email: emailB });

    // Choose stickerId = 999 which user doesn’t have (default is [0,1,2,3,4])
    const res = await request(app)
      .put(`/api/v1/stickerboards/${boardId}`)
      .set(authHeader(tokenB))
      .send({
        sticker: { stickerId: 999, x: 10, y: 10 }
      })
      .expect(400);

    // Assertions
    expect(res.body.error).toMatch(/User does not have the required sticker/i);

    // Board unchanged
    const board = await Stickerboard.findById(boardId);
    expect(board.stickers.length).toBe(0);

    // User B cheersStickers unchanged
    const userB = await User.findOne({ email: emailB });
    expect(userB.cheersStickers).toEqual([0, 1, 2, 3, 4]);
  });

  test('Test 6 — Non-owner can append one owned cheers sticker (using sticker object form)', async () => {
    // Setup
    const { token: tokenA } = await registerVerifyLogin({ email: 'owner6@example.com' });
    const { boardId } = await createBoard({
      token: tokenA,
      name: 'Happy Path Board',
      description: 'Happy Path'
    });

    const emailB = 'nonowner6@example.com';
    const { token: tokenB } = await registerVerifyLogin({ email: emailB });

    // Action: Use owned stickerId = 1
    const res = await request(app)
      .put(`/api/v1/stickerboards/${boardId}`)
      .set(authHeader(tokenB))
      .send({
        sticker: { stickerId: 1, x: 100, y: 200, scale: 1.2 }
      })
      .expect(200);

    // Assertions
    expect(res.body.success).toBe(true);
    expect(res.body.data.stickers.length).toBe(1);

    const lastSticker = res.body.data.stickers[0];
    expect(lastSticker.stickerId).toBe(1);
    expect(lastSticker.isCheers).toBe(true);
    expect(lastSticker.stuck).toBe(true);

    // Fetch User B from DB and assert cheersStickers does not include 1
    const userB = await User.findOne({ email: emailB });
    expect(userB.cheersStickers).not.toContain(1);
    expect(userB.cheersStickers.length).toBe(4);
  });

  test('Test 7 — Non-owner can also append using stickers array form (compat coverage)', async () => {
    // Setup
    const { token: tokenA } = await registerVerifyLogin({ email: 'owner7@example.com' });
    const { boardId } = await createBoard({
      token: tokenA,
      name: 'Array Form Board',
      description: 'Array Form'
    });

    const emailB = 'nonowner7@example.com';
    const { token: tokenB } = await registerVerifyLogin({ email: emailB });

    // Action: Send stickers array with one new sticker (length becomes 1)
    const res = await request(app)
      .put(`/api/v1/stickerboards/${boardId}`)
      .set(authHeader(tokenB))
      .send({
        stickers: [{ stickerId: 2, x: 50, y: 50 }]
      })
      .expect(200);

    // Assertions
    expect(res.body.success).toBe(true);
    expect(res.body.data.stickers.length).toBe(1);
    expect(res.body.data.stickers[0].stickerId).toBe(2);

    // Verify consumption
    const userB = await User.findOne({ email: emailB });
    expect(userB.cheersStickers).not.toContain(2);
  });

  test('Test 8 — Double-spend prevention: two concurrent requests, one success', async () => {
    // Check if transactions are supported
    const session = await mongoose.startSession();
    let hasTransactions = true;
    try {
      await session.startTransaction();
      await session.abortTransaction();
    } catch (err) {
      if (err.code === 20 || err.message.includes('replica set')) {
        hasTransactions = false;
      }
    }
    session.endSession();

    if (!hasTransactions) {
      console.log('Skipping Test 8: MongoDB transactions not supported');
      return;
    }

    // Setup
    const { token: tokenA } = await registerVerifyLogin({ email: 'owner8@example.com' });
    const { boardId } = await createBoard({
      token: tokenA,
      name: 'Race Condition Board',
      description: 'Race Condition'
    });

    const emailB = 'nonowner8@example.com';
    const { token: tokenB } = await registerVerifyLogin({ email: emailB });

    // Prepare two requests with the same payload (using stickerId = 2)
    const payload = { sticker: { stickerId: 2, x: 1, y: 1 } };

    const req1 = request(app)
      .put(`/api/v1/stickerboards/${boardId}`)
      .set(authHeader(tokenB))
      .send(payload);

    const req2 = request(app)
      .put(`/api/v1/stickerboards/${boardId}`)
      .set(authHeader(tokenB))
      .send(payload);

    // Action: Fire both without awaiting the first
    const [r1, r2] = await Promise.allSettled([req1, req2]);

    // Assertions
    const results = [r1, r2].map(r => r.value.status);
    expect(results).toContain(200);
    // Transaction write conflict may cause 500, accept either 400 or 500 for the failed request
    expect(results.some(s => s === 400 || s === 500)).toBe(true);

    // User B’s cheersStickers no longer contains 2
    const userB = await User.findOne({ email: emailB });
    expect(userB.cheersStickers).not.toContain(2);

    // Board contains only one appended sticker with stickerId=2
    const board = await Stickerboard.findById(boardId);
    expect(board.stickers.length).toBe(1);
    expect(board.stickers[0].stickerId).toBe(2);
  });

  test('Test 9 — Owner allowlist works (owner can update name/description; random field ignored)', async () => {
    // Setup
    const { token: tokenA } = await registerVerifyLogin({ email: 'owner9@example.com' });
    const { boardId } = await createBoard({
      token: tokenA,
      name: 'Allowlist Board',
      description: 'Allowlist'
    });

    // Action: User A sends name, description, and an evil field
    const res = await request(app)
      .put(`/api/v1/stickerboards/${boardId}`)
      .set(authHeader(tokenA))
      .send({
        name: 'New Name',
        description: 'New Desc',
        evil: 'nope'
      })
      .expect(200);

    // Assertions
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('New Name');
    expect(res.body.data.description).toBe('New Desc');

    // evil not present in DB
    const board = await Stickerboard.findById(boardId).lean();
    expect(board.evil).toBeUndefined();
    expect(res.body.data.evil).toBeUndefined();
  });
});
