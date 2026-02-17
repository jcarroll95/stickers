const { awardSticker, revokeSticker } = require('../../usecases/stickers/stickerTransactions');
const StickerInventory = require('../../models/StickerInventory');
const StickerDefinition = require('../../models/StickerDefinition');
const OperationLog = require('../../models/OperationLog');
const { emitAuditEvent } = require('../../utils/audit');
const mongoose = require('mongoose');

jest.mock('../../models/StickerInventory');
jest.mock('../../models/StickerDefinition');
jest.mock('../../models/OperationLog');
jest.mock('../../utils/audit');

// Mock mongoose session
const mockSession = {
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  abortTransaction: jest.fn(),
  endSession: jest.fn(),
  inTransaction: jest.fn().mockReturnValue(true)
};
mongoose.startSession = jest.fn().mockResolvedValue(mockSession);

describe('stickerTransactions', () => {
  const actorId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  const stickerId = new mongoose.Types.ObjectId();
  const mockReq = { user: { _id: actorId }, headers: {} };

  beforeEach(() => {
    mongoose.startSession.mockResolvedValue(mockSession);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  describe('awardSticker', () => {
    test('is idempotent if transaction with opId already exists', async () => {
      const existingOp = {
        status: 'completed',
        result: { some: 'data' }
      };
      OperationLog.findOne.mockReturnValue({
        session: jest.fn().mockResolvedValue(existingOp)
      });

      const result = await awardSticker({ userId, stickerId, opId: 'op1', req: mockReq });

      expect(result.message).toBe('Transaction already completed');
      expect(mockSession.commitTransaction).toHaveBeenCalled();
    });

    test('increments quantity of existing sticker entry if opId is new', async () => {
      OperationLog.findOne.mockReturnValue({ session: jest.fn().mockResolvedValue(null) });
      OperationLog.findOneAndUpdate.mockResolvedValue({ _id: 'oplog1' });

      const mockEntry = {
        _id: 'inv1',
        quantity: 2,
        packId: new mongoose.Types.ObjectId(),
        save: jest.fn().mockResolvedValue(true)
      };
      StickerInventory.findOneAndUpdate.mockResolvedValue(mockEntry);
      OperationLog.findByIdAndUpdate.mockResolvedValue({});
      StickerDefinition.findById.mockReturnValue({ session: jest.fn().mockResolvedValue({ packId: mockEntry.packId }) });

      const result = await awardSticker({ userId, stickerId, opId: 'op2', req: mockReq });

      expect(result.result.quantity).toBe(2);
      expect(result.message).toBe('Sticker awarded successfully');
    });

    test('creates new entry if sticker not in inventory', async () => {
      OperationLog.findOne.mockReturnValue({ session: jest.fn().mockResolvedValue(null) });
      OperationLog.findOneAndUpdate.mockResolvedValue({ _id: 'oplog2' });

      const mockEntry = {
        _id: 'inv2',
        quantity: 1,
        packId: new mongoose.Types.ObjectId(),
        save: jest.fn().mockResolvedValue(true)
      };
      StickerInventory.findOneAndUpdate.mockResolvedValue(mockEntry);
      OperationLog.findByIdAndUpdate.mockResolvedValue({});
      StickerDefinition.findById.mockReturnValue({ session: jest.fn().mockResolvedValue({ packId: mockEntry.packId }) });

      const result = await awardSticker({ userId, stickerId, opId: 'op3', req: mockReq });

      expect(result.message).toBe('Sticker awarded successfully');
      expect(result.result.quantity).toBe(1);
    });
  });

  describe('revokeSticker', () => {
    test('decrements quantity if sticker exists', async () => {
      OperationLog.findOne.mockReturnValue({ session: jest.fn().mockResolvedValue(null) });
      OperationLog.findOneAndUpdate.mockResolvedValue({ _id: 'oplog3' });

      const mockEntry = {
        _id: 'inv1',
        quantity: 2,
        save: jest.fn().mockResolvedValue(true)
      };
      StickerInventory.findOne.mockReturnValue({ session: jest.fn().mockResolvedValue(mockEntry) });
      OperationLog.findByIdAndUpdate.mockResolvedValue({});

      const result = await revokeSticker({ userId, stickerId, opId: 'op4', req: mockReq });

      expect(mockEntry.quantity).toBe(1);
      expect(result.message).toBe('Sticker revoked successfully');
    });

    test('throws 404 if sticker not available', async () => {
      OperationLog.findOne.mockReturnValue({ session: jest.fn().mockResolvedValue(null) });
      OperationLog.findOneAndUpdate.mockResolvedValue({ _id: 'oplog4' });

      StickerInventory.findOne.mockReturnValue({ session: jest.fn().mockResolvedValue(null) });
      OperationLog.findByIdAndUpdate.mockResolvedValue({});

      await expect(revokeSticker({ userId, stickerId, opId: 'op5', req: mockReq }))
        .rejects.toThrow('Sticker not available in user inventory');
    });
  });
});
