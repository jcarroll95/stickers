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

jest.mock('../../models/StickerInventory');
jest.mock('../../models/StickerDefinition');
jest.mock('../../models/StickerPack');
jest.mock('../../models/User');

describe('adminInventoryUsecases', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserInventoryAndCatalog', () => {
    test('fetches user, inventory, and catalog by email identifier', async () => {
      User.findOne.mockResolvedValue({ _id: 'u123', name: 'Tester', email: 't@ex.com' });
      StickerInventory.find.mockReturnValue({ populate: jest.fn().mockResolvedValue([{ _id: 'inv1' }]) });
      StickerPack.find.mockReturnValue({ populate: jest.fn().mockResolvedValue([{ _id: 'p1' }]) });
      StickerDefinition.find.mockResolvedValue([{ _id: 's1' }]);

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
      const mockEntry = { userId: 'u1', stickerId: 's1', quantity: 2, save: jest.fn() };
      StickerInventory.findOne.mockResolvedValue(mockEntry);

      await addStickerToInventory({ userId: 'u1', stickerId: 's1', quantity: 3 });

      expect(mockEntry.quantity).toBe(5);
      expect(mockEntry.save).toHaveBeenCalled();
    });

    test('creates new entry if sticker not in inventory', async () => {
      StickerInventory.findOne.mockResolvedValue(null);
      StickerDefinition.findById.mockResolvedValue({ _id: 's1', packId: 'p1' });
      StickerInventory.create.mockResolvedValue({ userId: 'u1', stickerId: 's1', quantity: 1 });

      await addStickerToInventory({ userId: 'u1', stickerId: 's1' });

      expect(StickerInventory.create).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'u1',
        stickerId: 's1',
        packId: 'p1',
        quantity: 1
      }));
    });
  });

  describe('removeStickerFromInventory', () => {
    test('decrements quantity and deletes if <= 0', async () => {
      const mockEntry = { quantity: 1, deleteOne: jest.fn() };
      StickerInventory.findOne.mockResolvedValue(mockEntry);

      const result = await removeStickerFromInventory({ userId: 'u1', stickerId: 's1', quantity: 1 });

      expect(mockEntry.deleteOne).toHaveBeenCalled();
      expect(result.deleted).toBe(true);
    });
  });

  describe('addPackToInventory', () => {
    test('uses bulkWrite to add all stickers in a pack', async () => {
      StickerPack.findById.mockResolvedValue({
        _id: 'p1',
        stickers: ['s1', 's2']
      });

      await addPackToInventory({ userId: 'u1', packId: 'p1' });

      expect(StickerInventory.bulkWrite).toHaveBeenCalledWith(expect.arrayContaining([
        expect.objectContaining({ updateOne: expect.objectContaining({ filter: { userId: 'u1', stickerId: 's1' } }) }),
        expect.objectContaining({ updateOne: expect.objectContaining({ filter: { userId: 'u1', stickerId: 's2' } }) })
      ]));
    });
  });
});
