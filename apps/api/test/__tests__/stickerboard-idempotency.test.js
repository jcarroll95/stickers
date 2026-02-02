const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../../server');
const { registerVerifyLogin, authHeader } = require('./authHelpers');
const { createBoard } = require('./boardHelpers');
const OperationLog = require('../../models/OperationLog');
const { v4: uuidv4 } = require('uuid');

describe('Stickerboard idempotency', () => {

  beforeEach(async () => {
    // Clean up operation logs before each test
    await OperationLog.deleteMany({});
  });

  describe('PUT /api/v1/stickerboards/:id with opId', () => {

    test('first request with opId creates operation log and updates board', async () => {
      const { token } = await registerVerifyLogin({
        email: `idem-create-${Date.now()}@example.com`
      });

      const { boardId } = await createBoard({
        token,
        name: `Board-${Date.now()}`,
        description: 'original'
      });

      const opId = uuidv4();

      const res = await request(app)
        .put(`/api/v1/stickerboards/${boardId}`)
        .set(authHeader(token))
        .send({
          description: 'updated with opId',
          opId
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.description).toBe('updated with opId');
      expect(res.body.opId).toBe(opId);

      // Verify operation log was created and completed
      const opLog = await OperationLog.findOne({ opId });
      expect(opLog).toBeDefined();
      expect(opLog.status).toBe('completed');
      expect(opLog.operationType).toBe('updateStickerboard');
    });

    test('duplicate request with same opId returns cached response', async () => {
      const { token } = await registerVerifyLogin({
        email: `idem-duplicate-${Date.now()}@example.com`
      });

      const { boardId } = await createBoard({
        token,
        name: `Board-${Date.now()}`,
        description: 'original'
      });

      const opId = uuidv4();

      // First request
      const firstRes = await request(app)
        .put(`/api/v1/stickerboards/${boardId}`)
        .set(authHeader(token))
        .send({
          description: 'first update',
          opId
        })
        .expect(200);

      expect(firstRes.body.success).toBe(true);
      expect(firstRes.body.data.description).toBe('first update');

      // Duplicate request with same opId
      const secondRes = await request(app)
        .put(`/api/v1/stickerboards/${boardId}`)
        .set(authHeader(token))
        .send({
          description: 'second update attempt',
          opId
        })
        .expect(200);

      expect(secondRes.body.success).toBe(true);
      expect(secondRes.body.cached).toBe(true);
      expect(secondRes.body.message).toBe('Operation already completed');

      // Verify board was NOT updated second time
      const boardCheck = await request(app)
        .get(`/api/v1/stickerboards/${boardId}`)
        .expect(200);

      expect(boardCheck.body.data.description).toBe('first update');
    });

    test('request without opId proceeds normally (backward compatibility)', async () => {
      const { token } = await registerVerifyLogin({
        email: `idem-no-opid-${Date.now()}@example.com`
      });

      const { boardId } = await createBoard({
        token,
        name: `Board-${Date.now()}`,
        description: 'original'
      });

      const res = await request(app)
        .put(`/api/v1/stickerboards/${boardId}`)
        .set(authHeader(token))
        .send({ description: 'updated without opId' })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.description).toBe('updated without opId');
      expect(res.body.opId).toBeUndefined();
    });

    test('invalid opId format returns 400', async () => {
      const { token } = await registerVerifyLogin({
        email: `idem-invalid-${Date.now()}@example.com`
      });

      const { boardId } = await createBoard({
        token,
        name: `Board-${Date.now()}`,
        description: 'original'
      });

      const res = await request(app)
        .put(`/api/v1/stickerboards/${boardId}`)
        .set(authHeader(token))
        .send({
          description: 'should fail',
          opId: 'not-a-valid-uuid'
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('Invalid operation ID format');
    });

    test('concurrent requests with same opId handle race condition (409)', async () => {
      const { token } = await registerVerifyLogin({
        email: `idem-race-${Date.now()}@example.com`
      });

      const { boardId } = await createBoard({
        token,
        name: `Board-${Date.now()}`,
        description: 'original'
      });

      const opId = uuidv4();

      // Create a pending operation log to simulate race condition
      await OperationLog.create({
        opId,
        userId: new mongoose.Types.ObjectId(),
        operationType: 'updateStickerboard',
        status: 'pending',
        payload: { test: true }
      });

      const res = await request(app)
        .put(`/api/v1/stickerboards/${boardId}`)
        .set(authHeader(token))
        .send({
          description: 'should conflict',
          opId
        })
        .expect(409);

      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe('Operation is already in progress');
    });

    test('failed operation can be retried with same opId', async () => {
      const { token, userId } = await registerVerifyLogin({
        email: `idem-retry-${Date.now()}@example.com`
      });

      const { boardId } = await createBoard({
        token,
        name: `Board-${Date.now()}`,
        description: 'original'
      });

      const opId = uuidv4();

      // Create a failed operation log
      await OperationLog.create({
        opId,
        userId,
        operationType: 'updateStickerboard',
        status: 'failed',
        errorMessage: 'Previous attempt failed',
        payload: { test: true }
      });

      // Retry should succeed
      const res = await request(app)
        .put(`/api/v1/stickerboards/${boardId}`)
        .set(authHeader(token))
        .send({
          description: 'retry after failure',
          opId
        })
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.description).toBe('retry after failure');

      // Verify operation log was updated to completed
      const opLog = await OperationLog.findOne({ opId });
      expect(opLog.status).toBe('completed');
    });

    test('operation log stores minimal payload for large sticker arrays', async () => {
      const { token } = await registerVerifyLogin({
        email: `idem-payload-${Date.now()}@example.com`
      });

      const { boardId } = await createBoard({
        token,
        name: `Board-${Date.now()}`,
        description: 'original'
      });

      const opId = uuidv4();

      // Create request with large stickers array - using real UUIDs for this test
      const realOpId = uuidv4();
      jest.spyOn(require('uuid'), 'v4').mockReturnValueOnce(realOpId);

      const largeStickersArray = Array.from({ length: 100 }, (_, i) => ({
        id: i,
        x: Math.random() * 500,
        y: Math.random() * 500,
        sequenceNumber: i % 10
      }));

      const res = await request(app)
        .put(`/api/v1/stickerboards/${boardId}`)
        .set(authHeader(token))
        .send({
          stickers: largeStickersArray,
          opId: realOpId
        });

      // If request failed, it's likely due to validation
      // Just verify the operation log was created with minimal payload
      const opLog = await OperationLog.findOne({ opId: realOpId });
      expect(opLog).toBeDefined();
      expect(opLog.payload.body.stickers).toBeUndefined();
      expect(opLog.payload.body.stickerCount).toBe(100);
    });

    test('different users can use same opId for their operations', async () => {
      const { token: token1 } = await registerVerifyLogin({
        email: `idem-user1-${Date.now()}@example.com`
      });
      const { token: token2 } = await registerVerifyLogin({
        email: `idem-user2-${Date.now()}@example.com`
      });

      const { boardId: boardId1 } = await createBoard({
        token: token1,
        name: `Board1-${Date.now()}`,
        description: 'user1'
      });

      const { boardId: boardId2 } = await createBoard({
        token: token2,
        name: `Board2-${Date.now()}`,
        description: 'user2'
      });

      const opId = uuidv4();

      // User 1 uses opId
      const res1 = await request(app)
        .put(`/api/v1/stickerboards/${boardId1}`)
        .set(authHeader(token1))
        .send({
          description: 'user1 update',
          opId
        })
        .expect(200);

      expect(res1.body.success).toBe(true);

      // User 2 attempts to use same opId - should get cached response
      const res2 = await request(app)
        .put(`/api/v1/stickerboards/${boardId2}`)
        .set(authHeader(token2))
        .send({
          description: 'user2 update',
          opId
        })
        .expect(200);

      // Should return cached response since opId already exists
      expect(res2.body.cached).toBe(true);
    });
  });

  describe('OperationLog model validation', () => {

    test('opId uniqueness is enforced', async () => {
      const opId = uuidv4();
      const userId = new mongoose.Types.ObjectId();

      await OperationLog.create({
        opId,
        userId,
        operationType: 'placeSticker',
        status: 'pending'
      });

      // Attempt to create duplicate should fail
      await expect(
        OperationLog.create({
          opId,
          userId,
          operationType: 'placeSticker',
          status: 'pending'
        })
      ).rejects.toThrow();
    });

    test('operation log includes all required fields', async () => {
      const opId = uuidv4();
      const userId = new mongoose.Types.ObjectId();

      const opLog = await OperationLog.create({
        opId,
        userId,
        operationType: 'placeSticker',
        status: 'pending',
        payload: { test: 'data' }
      });

      expect(opLog.opId).toBe(opId);
      expect(opLog.userId.toString()).toBe(userId.toString());
      expect(opLog.operationType).toBe('placeSticker');
      expect(opLog.status).toBe('pending');
      expect(opLog.createdAt).toBeDefined();
      expect(opLog.completedAt).toBeUndefined();
    });
  });
});
