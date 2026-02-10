const {
  consumeCheersStickerForNonOwner,
  consumeInventoryStickerIfAppending,
} = require('../../usecases/stickers/consumeStickerForPlacement');
const User = require('../../models/User');
const StickerInventory = require('../../models/StickerInventory');

jest.mock('../../models/User');
jest.mock('../../models/StickerInventory');

describe('consumeStickerForPlacement', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('consumeCheersStickerForNonOwner', () => {
    test('consumes legacy numeric sticker from user array', async () => {
      const userMock = {
        cheersStickers: [1, 2, 3],
        save: jest.fn().mockResolvedValue(true),
      };
      User.findById.mockReturnValue({ session: jest.fn().mockResolvedValue(userMock) });

      const result = await consumeCheersStickerForNonOwner({ userId: 'u1', stickerId: 2 });

      expect(userMock.cheersStickers).toEqual([1, 3]);
      expect(userMock.save).toHaveBeenCalled();
      expect(result.mode).toBe('legacy');
    });

    test('consumes inventory ObjectId sticker', async () => {
      const stickerId = '507f1f17820d000000000001';
      const inventoryMock = {
        quantity: 5,
        save: jest.fn().mockResolvedValue(true),
      };
      StickerInventory.findOne.mockReturnValue({ session: jest.fn().mockResolvedValue(inventoryMock) });

      const result = await consumeCheersStickerForNonOwner({ userId: 'u1', stickerId });

      expect(inventoryMock.quantity).toBe(4);
      expect(inventoryMock.save).toHaveBeenCalled();
      expect(result.mode).toBe('inventory');
    });

    test('throws 400 if user does not have sticker', async () => {
      User.findById.mockReturnValue({ session: jest.fn().mockResolvedValue({ cheersStickers: [] }) });
      await expect(consumeCheersStickerForNonOwner({ userId: 'u1', stickerId: 1 }))
        .rejects.toThrow('User does not have the required sticker');
    });
  });

  describe('consumeInventoryStickerIfAppending', () => {
    test('consumes sticker if owner appends one new inventory sticker', async () => {
      const stickerId = '507f1f17820d000000000001';
      const inventoryMock = {
        quantity: 1,
        save: jest.fn().mockResolvedValue(true),
      };
      StickerInventory.findOne.mockReturnValue({ session: jest.fn().mockResolvedValue(inventoryMock) });

      const updatedStickers = [{ stickerId: 'existing' }, { stickerId }];
      const result = await consumeInventoryStickerIfAppending({
        userId: 'u1',
        isAdmin: false,
        existingStickersLength: 1,
        updatedStickers,
      });

      expect(inventoryMock.quantity).toBe(0);
      expect(result.consumed).toBe(true);
    });

    test('throws 400 if non-admin tries to append sticker they do not have', async () => {
      const stickerId = '507f1f17820d000000000001';
      StickerInventory.findOne.mockReturnValue({ session: jest.fn().mockResolvedValue(null) });

      await expect(consumeInventoryStickerIfAppending({
        userId: 'u1',
        isAdmin: false,
        existingStickersLength: 0,
        updatedStickers: [{ stickerId }],
      })).rejects.toThrow('User does not have the required sticker');
    });

    test('returns consumed: false if not an append operation', async () => {
      const result = await consumeInventoryStickerIfAppending({
        userId: 'u1',
        isAdmin: false,
        existingStickersLength: 1,
        updatedStickers: [{ stickerId: 'one' }], // No change in length
      });
      expect(result.consumed).toBe(false);
    });
  });
});
