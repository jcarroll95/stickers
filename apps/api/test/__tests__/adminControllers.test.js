jest.mock('../../models/StickerDefinition', () => ({}), { virtual: true });
jest.mock('../../models/MediaVariant', () => ({}), { virtual: true });
jest.mock('../../models/StickerPack', () => ({}), { virtual: true });
const adminStickers = require('../../controllers/adminStickers');
const adminPack = require('../../controllers/adminPacks');
const adminBulk = require('../../controllers/adminBulk');
const { updateStickerStatus } = require('../../usecases/admin/stickers/updateStickerStatus');
const { updatePack } = require('../../usecases/admin/packs/updatePack');
const { bulkUpdateStickerStatus } = require('../../usecases/admin/stickers/bulkUpdateStickerStatus');

jest.mock('../../usecases/admin/stickers/updateStickerStatus');
jest.mock('../../usecases/admin/packs/updatePack');
jest.mock('../../usecases/admin/stickers/bulkUpdateStickerStatus');

describe('Admin Controllers', () => {
  let req, res, next;

  beforeEach(() => {
    req = {
      params: {},
      body: {},
      user: { _id: 'u1', role: 'admin' },
    };
    res = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  describe('adminStickers.updateStickerStatus', () => {
    test('should call usecase and return sticker', async () => {
      req.params.id = 's1';
      req.body.status = 'active';
      updateStickerStatus.mockResolvedValue({ sticker: { _id: 's1', status: 'active' } });

      await adminStickers.updateStickerStatus(req, res, next);

      expect(updateStickerStatus).toHaveBeenCalledWith(expect.objectContaining({
        stickerId: 's1',
        nextStatus: 'active',
      }));
      expect(res.json).toHaveBeenCalledWith({ ok: true, sticker: { _id: 's1', status: 'active' } });
    });
  });

  describe('adminPack.updatePack', () => {
    test('should call usecase and return pack', async () => {
      req.params.id = 'p1';
      req.body = { name: 'New Name' };
      updatePack.mockResolvedValue({ pack: { _id: 'p1', name: 'New Name' } });

      await adminPack.updatePack(req, res, next);

      expect(updatePack).toHaveBeenCalledWith(expect.objectContaining({
        packId: 'p1',
        updates: { name: 'New Name' },
      }));
      expect(res.json).toHaveBeenCalledWith({ ok: true, pack: { _id: 'p1', name: 'New Name' } });
    });
  });

  describe('adminBulk.bulkUpdateStickerStatus', () => {
    test('should call usecase and return result', async () => {
      req.body = { ids: ['s1', 's2'], status: 'ready' };
      bulkUpdateStickerStatus.mockResolvedValue({ matched: 2, modified: 2, beforeCounts: {} });

      await adminBulk.bulkUpdateStickerStatus(req, res, next);

      expect(bulkUpdateStickerStatus).toHaveBeenCalledWith(expect.objectContaining({
        ids: ['s1', 's2'],
        nextStatus: 'ready',
      }));
      expect(res.json).toHaveBeenCalledWith({
        ok: true,
        matched: 2,
        modified: 2,
        beforeCounts: {},
      });
    });
  });
});
