// apps/api/test/__tests__/auditTransactions.test.js

const mongoose = require('mongoose');
const OperationLog = require('../../models/OperationLog');

// Mock dependencies FIRST
jest.mock('../../utils/audit', () => ({
  emitAuditEvent: jest.fn().mockResolvedValue({}),
}));

// IMPORTANT: StickerInventory must be a constructor (used with `new StickerInventory(...)`)
jest.mock('../../models/StickerInventory', () => {
  const MockStickerInventory = jest.fn(function StickerInventoryDoc(doc) {
    Object.assign(this, doc);
    this.save = jest.fn().mockResolvedValue(this);
    this.deleteOne = jest.fn().mockResolvedValue(undefined);
  });

  // static methods used by usecases
  MockStickerInventory.findOne = jest.fn();
  MockStickerInventory.findOneAndUpdate = jest.fn();
  MockStickerInventory.create = jest.fn();
  MockStickerInventory.bulkWrite = jest.fn();
  MockStickerInventory.deleteMany = jest.fn();

  return MockStickerInventory;
});

jest.mock('../../models/StickerDefinition', () => ({
  findById: jest.fn(),
}));

jest.mock('../../models/StickerPack', () => ({
  findById: jest.fn(),
}));

jest.mock('../../models/OperationLog');

jest.mock('../../models/MediaVariant', () => ({}));

// Now import usecases + mocked modules
const { awardSticker, revokeSticker } = require('../../usecases/stickers/stickerTransactions');
const {
  addStickerToInventory,
  removeStickerFromInventory,
  addPackToInventory,
  removePackFromInventory,
} = require('../../usecases/inventory/adminInventoryUsecases');

const { emitAuditEvent } = require('../../utils/audit');
const StickerInventory = require('../../models/StickerInventory');
const StickerDefinition = require('../../models/StickerDefinition');
const StickerPack = require('../../models/StickerPack');

describe('Audit Logging for Transactions', () => {
  let mockReq;
  let mSession;

  beforeEach(() => {
    jest.clearAllMocks();
    mockReq = {
      id: 'req-123',
      user: { _id: new mongoose.Types.ObjectId() },
      ip: '127.0.0.1',
      headers: {},
    };

    mSession = {
      startTransaction: jest.fn(),
      commitTransaction: jest.fn(),
      abortTransaction: jest.fn(),
      endSession: jest.fn(),
      inTransaction: jest.fn().mockReturnValue(true),
    };

    jest.spyOn(mongoose, 'startSession').mockResolvedValue(mSession);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('stickerTransactions usecases', () => {
    const userId = new mongoose.Types.ObjectId();
    const stickerId = new mongoose.Types.ObjectId();
    const packId = new mongoose.Types.ObjectId();

    describe('awardSticker', () => {
      it('should emit audit event when awarding a new sticker', async () => {
        OperationLog.findOne.mockReturnValue({ session: jest.fn().mockResolvedValue(null) });
        OperationLog.findOneAndUpdate.mockResolvedValue({ _id: 'oplog1' });

        const mockEntry = {
          _id: 'inv1',
          quantity: 1,
          packId,
          save: jest.fn().mockResolvedValue(true)
        };
        StickerInventory.findOneAndUpdate.mockResolvedValue(mockEntry);
        OperationLog.findByIdAndUpdate.mockResolvedValue({});
        StickerDefinition.findById.mockReturnValue({
          session: jest.fn().mockResolvedValue({ packId }),
        });

        await awardSticker({ userId, stickerId, opId: 'op1', req: mockReq });

        expect(emitAuditEvent).toHaveBeenCalledWith(
          mockReq,
          expect.objectContaining({
            entityType: 'StickerDefinition',
            entityId: stickerId,
            action: 'sticker.award',
            meta: expect.objectContaining({ userId, opId: 'op1', quantity: 1 }),
          })
        );
      });

      it('should emit audit event when incrementing existing sticker', async () => {
        OperationLog.findOne.mockReturnValue({ session: jest.fn().mockResolvedValue(null) });
        OperationLog.findOneAndUpdate.mockResolvedValue({ _id: 'oplog2' });

        const mockEntry = {
          _id: 'inv1',
          quantity: 2,
          packId,
          save: jest.fn().mockResolvedValue(true)
        };
        StickerInventory.findOneAndUpdate.mockResolvedValue(mockEntry);
        OperationLog.findByIdAndUpdate.mockResolvedValue({});
        StickerDefinition.findById.mockReturnValue({
          session: jest.fn().mockResolvedValue({ packId }),
        });

        await awardSticker({ userId, stickerId, opId: 'op2', req: mockReq });

        expect(emitAuditEvent).toHaveBeenCalledWith(
          mockReq,
          expect.objectContaining({
            action: 'sticker.award',
            entityType: 'StickerDefinition',
            entityId: stickerId,
            meta: expect.objectContaining({
              userId,
              opId: 'op2',
              quantity: 1
            }),
          })
        );
      });
    });

    describe('revokeSticker', () => {
      it('should emit audit event when revoking a sticker', async () => {
        OperationLog.findOne.mockReturnValue({ session: jest.fn().mockResolvedValue(null) });
        OperationLog.findOneAndUpdate.mockResolvedValue({ _id: 'oplog3' });

        const mockEntry = {
          _id: 'inv1',
          quantity: 1,
          save: jest.fn().mockResolvedValue(true)
        };
        StickerInventory.findOne.mockReturnValue({ session: jest.fn().mockResolvedValue(mockEntry) });
        OperationLog.findByIdAndUpdate.mockResolvedValue({});

        await revokeSticker({ userId, stickerId, opId: 'op4', req: mockReq });

        expect(mockEntry.save).toHaveBeenCalled();

        expect(emitAuditEvent).toHaveBeenCalledWith(
          mockReq,
          expect.objectContaining({
            entityType: 'StickerDefinition',
            entityId: stickerId,
            action: 'sticker.revoke',
            meta: expect.objectContaining({ userId, opId: 'op4', quantity: 1 }),
          })
        );
      });
    });
  });

  describe('adminInventoryUsecases', () => {
    const userId = new mongoose.Types.ObjectId();
    const stickerId = new mongoose.Types.ObjectId();
    const packId = new mongoose.Types.ObjectId();

    describe('addStickerToInventory', () => {
      it('should emit audit event on admin add (new)', async () => {
        StickerInventory.findOne.mockResolvedValue(null);
        StickerDefinition.findById.mockResolvedValue({ packId });
        StickerInventory.create.mockResolvedValue({});

        await addStickerToInventory({ userId, stickerId, quantity: 2, req: mockReq });

        expect(emitAuditEvent).toHaveBeenCalledWith(
          mockReq,
          expect.objectContaining({
            action: 'sticker.admin_add',
            meta: expect.objectContaining({ quantity: 2, method: 'create' }),
          })
        );
      });
    });

    describe('removeStickerFromInventory', () => {
      it('should emit audit event on admin remove (not deleted)', async () => {
        const mockEntry = { quantity: 5, save: jest.fn().mockResolvedValue({}) };
        StickerInventory.findOne.mockResolvedValue(mockEntry);

        await removeStickerFromInventory({ userId, stickerId, quantity: 2, req: mockReq });

        expect(emitAuditEvent).toHaveBeenCalledWith(
          mockReq,
          expect.objectContaining({
            action: 'sticker.admin_remove',
            meta: expect.objectContaining({ quantity: 2, deleted: false }),
          })
        );
      });
    });

    describe('addPackToInventory', () => {
      it('should emit audit event on admin pack add', async () => {
        StickerPack.findById.mockResolvedValue({
          _id: packId,
          stickers: [stickerId, new mongoose.Types.ObjectId()],
        });

        StickerInventory.bulkWrite.mockResolvedValue({});

        await addPackToInventory({ userId, packId, req: mockReq });

        expect(emitAuditEvent).toHaveBeenCalledWith(
          mockReq,
          expect.objectContaining({
            entityType: 'StickerPack',
            entityId: packId,
            action: 'pack.admin_add',
            meta: expect.objectContaining({ stickerCount: 2 }),
          })
        );
      });
    });

    describe('removePackFromInventory', () => {
      it('should emit audit event on admin pack remove', async () => {
        StickerPack.findById.mockResolvedValue({
          _id: packId,
          stickers: [stickerId, new mongoose.Types.ObjectId()],
        });

        StickerInventory.bulkWrite.mockResolvedValue({});
        StickerInventory.deleteMany.mockResolvedValue({});

        await removePackFromInventory({ userId, packId, req: mockReq });

        expect(emitAuditEvent).toHaveBeenCalledWith(
          mockReq,
          expect.objectContaining({
            entityType: 'StickerPack',
            entityId: packId,
            action: 'pack.admin_remove',
          })
        );
      });
    });
  });
});
