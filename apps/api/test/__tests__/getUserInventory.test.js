const { getUserInventory } = require('../../usecases/stickers/getUserInventory');
const StickerInventory = require('../../models/StickerInventory');
const ErrorResponse = require('../../utils/errorResponse');

jest.mock('../../models/StickerInventory');

describe('getUserInventory', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('fetches and transforms inventory for a user', async () => {
    const mockInventory = [
      {
        _id: 'inv1',
        quantity: 5,
        stickerId: {
          _id: 's1',
          name: 'Super Sticker',
          imageUrl: 'http://img.com/s1',
          packId: { _id: 'p1', name: 'Cool Pack' }
        },
        packId: null
      }
    ];

    StickerInventory.find.mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      then: jest.fn().mockImplementation((callback) => callback(mockInventory))
    });

    // Alternatively, mock the chain more traditionally
    StickerInventory.find.mockReturnValue({
      populate: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(mockInventory)
    });
    // But usecases/stickers/getUserInventory.js uses await StickerInventory.find().populate().populate() directly
    // which returns a Query object that is thenable.

    StickerInventory.find.mockImplementation(() => ({
      populate: jest.fn().mockReturnThis(),
      then: function(onFulfilled) {
        return Promise.resolve(mockInventory).then(onFulfilled);
      }
    }));

    const result = await getUserInventory({ userId: 'u1' });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual(expect.objectContaining({
      id: 's1',
      name: 'Super Sticker',
      packName: 'Cool Pack',
      quantity: 5
    }));
  });

  test('throws 400 if userId is missing', async () => {
    await expect(getUserInventory({})).rejects.toThrow('userId is required');
  });
});
