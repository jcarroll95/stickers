// apps/api/test/__tests__/adminInventoryUsecases.test.js

const mongoose = require('mongoose');

jest.mock('../../utils/audit', () => ({
  emitAuditEvent: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../models/StickerDefinition', () => ({
  findById: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
}));

jest.mock('../../models/StickerPack', () => ({
  find: jest.fn(),
  findById: jest.fn(),
}));

jest.mock('../../models/StickerInventory', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  create: jest.fn(),
  bulkWrite: jest.fn(),
  deleteMany: jest.fn(),
}));

jest.mock('../../models/User', () => ({
  findById: jest.fn(),
  findOne: jest.fn(),
}));

// Mock in case we ref MediaVariant and something deep tries to load it,
jest.mock('../../models/MediaVariant', () => ({}));

const {
  getUserInventoryAndCatalog,
  addStickerToInventory,
  removeStickerFromInventory,
  addPackToInventory,
} = require('../../usecases/inventory/adminInventoryUsecases');

const StickerInventory = require('../../models/StickerInventory');
const StickerDefinition = require('../../models/StickerDefinition');
const StickerPack = require('../../models/StickerPack');
const User = require('../../models/User');
const { emitAuditEvent } = require('../../utils/audit');

describe('adminInventoryUsecases', () => {
  const userId = new mongoose.Types.ObjectId();
  const stickerId = new mongoose.Types.ObjectId();
  const packId = new mongoose.Types.ObjectId();
  const actorId = new mongoose.Types.ObjectId();
  const mockReq = { user: { _id: actorId }, headers: {} };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserInventoryAndCatalog', () => {
    test('fetches user, inventory, and catalog by email identifier', async () => {
      User.findOne.mockResolvedValue({ _id: userId, name: 'Tester', email: 't@ex.com' });

      // StickerInventory.find(...).populate(...) chain
      StickerInventory.find.mockReturnValue({
        populate: jest.fn().mockResolvedValue([{ _id: 'inv1' }]),
      });

      // StickerPack.find(...).populate(...) chain
      StickerPack.find.mockReturnValue({
        populate: jest.fn().mockResolvedValue([{ _id: packId, stickers: [] }]),
      });

      StickerDefinition.find.mockResolvedValue([{ _id: stickerId }]);

      const result = await getUserInventoryAndCatalog({ identifier: 't@ex.com' });

      expect(User.findOne).toHaveBeenCalled();
      expect(result.user.email).toBe('t@ex.com');
      expect(result.inventory).toHaveLength(1);
      expect(result.catalog.packs).toHaveLength(1);
    });

    test('throws 404 if user not found', async () => {
      User.findById.mockResolvedValue(null);
      User.findOne.mockResolvedValue(null);

      await expect(getUserInventoryAndCatalog({ identifier: 'missing' })).rejects.toThrow('User not found');
    });
  });

  describe('addStickerToInventory', () => {
    test('increments quantity if sticker already in inventory', async () => {
      const mockEntry = { userId, stickerId, quantity: 2, save: jest.fn().mockResolvedValue(undefined) };
      StickerInventory.findOne.mockResolvedValue(mockEntry);

      await addStickerToInventory({ userId, stickerId, quantity: 3, req: mockReq });

      expect(mockEntry.quantity).toBe(5);
      expect(mockEntry.save).toHaveBeenCalled();
      expect(emitAuditEvent).toHaveBeenCalled();
    });

    test('creates new entry if sticker not in inventory', async () => {
      StickerInventory.findOne.mockResolvedValue(null);

      StickerDefinition.findById.mockResolvedValue({ _id: stickerId, packId });

      StickerInventory.create.mockResolvedValue({ userId, stickerId, quantity: 1, packId });

      await addStickerToInventory({ userId, stickerId, req: mockReq });

      // This is the assertion you expected to pass; now it will.
      expect(StickerDefinition.findById).toHaveBeenCalledWith(stickerId);

      expect(StickerInventory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId,
          stickerId,
          packId,
          quantity: 1,
        })
      );

      expect(emitAuditEvent).toHaveBeenCalled();
    });
  });

  describe('removeStickerFromInventory', () => {
    test('decrements quantity and deletes if <= 0', async () => {
      const mockEntry = { quantity: 1, deleteOne: jest.fn().mockResolvedValue(undefined) };
      StickerInventory.findOne.mockResolvedValue(mockEntry);

      const result = await removeStickerFromInventory({ userId, stickerId, quantity: 1, req: mockReq });

      expect(mockEntry.deleteOne).toHaveBeenCalled();
      expect(result.deleted).toBe(true);
      expect(emitAuditEvent).toHaveBeenCalled();
    });
  });

  describe('addPackToInventory', () => {
    test('uses bulkWrite to add all stickers in a pack', async () => {
      StickerPack.findById.mockResolvedValue({
        _id: packId,
        stickers: [stickerId, new mongoose.Types.ObjectId()],
      });

      StickerInventory.bulkWrite.mockResolvedValue({ ok: 1 });

      await addPackToInventory({ userId, packId, req: mockReq });

      expect(StickerInventory.bulkWrite).toHaveBeenCalled();

      const ops = StickerInventory.bulkWrite.mock.calls[0][0];
      expect(Array.isArray(ops)).toBe(true);
      expect(ops.length).toBe(2);

      // spot-check first operation shape
      expect(ops[0]).toEqual(
        expect.objectContaining({
          updateOne: expect.objectContaining({
            filter: expect.objectContaining({ userId }),
            upsert: true,
          }),
        })
      );

      expect(emitAuditEvent).toHaveBeenCalled();
    });
  });
});
