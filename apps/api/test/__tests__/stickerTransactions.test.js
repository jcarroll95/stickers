const { awardSticker, revokeSticker } = require('../../usecases/stickers/stickerTransactions');
const StickerInventory = require('../../models/StickerInventory');
const StickerDefinition = require('../../models/StickerDefinition');
const mongoose = require('mongoose');

jest.mock('../../models/StickerInventory');
jest.mock('../../models/StickerDefinition');

// Mock mongoose session
const mockSession = {
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  abortTransaction: jest.fn(),
  endSession: jest.fn(),
};
mongoose.startSession = jest.fn().mockResolvedValue(mockSession);

describe('stickerTransactions', () => {
  const actorId = new mongoose.Types.ObjectId();
  const userId = new mongoose.Types.ObjectId();
  const stickerId = new mongoose.Types.ObjectId();
  const mockReq = { user: { _id: actorId }, headers: {} };

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('awardSticker', () => {
    test('is idempotent if transaction with opId already exists', async () => {
      const existingEntry = { _id: 'inv1' };
      StickerInventory.findOne.mockReturnValue({ session: jest.fn().mockResolvedValue(existingEntry) });

      const result = await awardSticker({ userId, stickerId, opId: 'op1', req: mockReq });

      expect(result.message).toBe('Transaction already completed');
      expect(mockSession.commitTransaction).toHaveBeenCalled();
    });

    test('increments quantity of existing sticker entry if opId is new', async () => {
      // First call (idempotency check) returns null
      // Second call (find existing sticker) returns entry
      const mockEntry = {
        quantity: 1,
        save: jest.fn().mockResolvedValue(true),
        packId: new mongoose.Types.ObjectId()
      };
      StickerInventory.findOne
        .mockReturnValueOnce({ session: jest.fn().mockResolvedValue(null) })
        .mockReturnValueOnce({ session: jest.fn().mockResolvedValue(mockEntry) });

      const result = await awardSticker({ userId, stickerId, opId: 'op2', req: mockReq });

      expect(mockEntry.quantity).toBe(2);
      expect(mockEntry.opId).toBe('op2');
      expect(result.message).toBe('Sticker quantity incremented');
    });

    test('creates new entry if sticker not in inventory', async () => {
      StickerInventory.findOne.mockReturnValue({ session: jest.fn().mockResolvedValue(null) });
      StickerDefinition.findById.mockReturnValue({ session: jest.fn().mockResolvedValue({ packId: new mongoose.Types.ObjectId() }) });

      // Mock StickerInventory constructor
      const saveMock = jest.fn().mockResolvedValue(true);
      StickerInventory.prototype.save = saveMock;

      const result = await awardSticker({ userId, stickerId, opId: 'op3', req: mockReq });

      expect(result.message).toBe('Sticker awarded successfully');
      expect(saveMock).toHaveBeenCalled();
    });
  });

  describe('revokeSticker', () => {
    test('decrements quantity if sticker exists', async () => {
      const mockEntry = { quantity: 2, save: jest.fn().mockResolvedValue(true) };
      StickerInventory.findOne
        .mockReturnValueOnce({ session: jest.fn().mockResolvedValue(null) })
        .mockReturnValueOnce({ session: jest.fn().mockResolvedValue(mockEntry) });

      const result = await revokeSticker({ userId, stickerId, opId: 'op4', req: mockReq });

      expect(mockEntry.quantity).toBe(1);
      expect(result.message).toBe('Sticker consumed successfully');
    });

    test('throws 404 if sticker not available', async () => {
      StickerInventory.findOne.mockReturnValue({ session: jest.fn().mockResolvedValue(null) });

      await expect(revokeSticker({ userId, stickerId, opId: 'op5', req: mockReq }))
        .rejects.toThrow('Sticker not available in user inventory');
    });
  });
});
