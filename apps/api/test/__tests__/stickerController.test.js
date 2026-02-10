const { createStickerTransaction, revokeStickerTransaction, getInventory } = require('../../controllers/stickerController');
const { awardSticker, revokeSticker } = require('../../usecases/stickers/stickerTransactions');
const { getUserInventory } = require('../../usecases/stickers/getUserInventory');

jest.mock('../../usecases/stickers/stickerTransactions');
jest.mock('../../usecases/stickers/getUserInventory');

describe('stickerController', () => {
  let req, res;

  beforeEach(() => {
    req = { params: {}, body: {} };
    res = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
    };
    jest.clearAllMocks();
  });

  describe('createStickerTransaction', () => {
    test('calls awardSticker with correct params and returns success', async () => {
      req.params.userId = 'user123';
      req.body = { stickerId: 'stick1', opId: 'op1' };
      const result = { id: 'tx1' };
      awardSticker.mockResolvedValue({ result, message: 'Awarded' });

      await createStickerTransaction(req, res);

      expect(awardSticker).toHaveBeenCalledWith({
        userId: 'user123',
        stickerId: 'stick1',
        opId: 'op1'
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Awarded',
        data: result
      });
    });

    test('prefers userId from body if not in params', async () => {
      req.body = { userId: 'userBody', stickerId: 'stick1', opId: 'op1' };
      awardSticker.mockResolvedValue({ result: {}, message: 'Awarded' });

      await createStickerTransaction(req, res);

      expect(awardSticker).toHaveBeenCalledWith(expect.objectContaining({ userId: 'userBody' }));
    });
  });

  describe('revokeStickerTransaction', () => {
    test('calls revokeSticker with correct params and returns success', async () => {
      req.params.userId = 'user123';
      req.body = { stickerId: 'stick1', opId: 'op1' };
      const result = { id: 'tx2' };
      revokeSticker.mockResolvedValue({ result, message: 'Revoked' });

      await revokeStickerTransaction(req, res);

      expect(revokeSticker).toHaveBeenCalledWith({
        userId: 'user123',
        stickerId: 'stick1',
        opId: 'op1'
      });
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Revoked',
        data: result
      });
    });
  });

  describe('getInventory', () => {
    test('calls getUserInventory and returns items with 200 status', async () => {
      req.params.userId = 'user123';
      const items = [{ id: 's1', name: 'Sticker 1' }];
      getUserInventory.mockResolvedValue({ items });

      await getInventory(req, res);

      expect(getUserInventory).toHaveBeenCalledWith({ userId: 'user123' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(items);
    });
  });
});
