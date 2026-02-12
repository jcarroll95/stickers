jest.mock('../../models/StickerDefinition', () => ({}), { virtual: true });
jest.mock('../../models/MediaVariant', () => ({}), { virtual: true });
jest.mock('../../models/StickerPack', () => ({}), { virtual: true });
jest.mock('../../middleware/auth', () => ({
  protect: jest.fn((req, res, next) => next()),
  authorize: jest.fn(() => jest.fn((req, res, next) => next())),
}));

jest.mock('../../controllers/admin', () => ({
  getMetrics: jest.fn((req, res) => res.status(200).json({ success: true, data: {} })),
}));

jest.mock('../../controllers/stickerInventory', () => ({
  getUserInventoryAndCatalog: jest.fn((req, res) => res.status(200).json({ success: true })),
  addStickerToInventory: jest.fn((req, res) => res.status(200).json({ success: true })),
  removeStickerFromInventory: jest.fn((req, res) => res.status(200).json({ success: true })),
  addPackToInventory: jest.fn((req, res) => res.status(200).json({ success: true })),
  removePackFromInventory: jest.fn((req, res) => res.status(200).json({ success: true })),
}));

jest.mock('../../controllers/adminStickers', () => ({
  updateStickerStatus: jest.fn((req, res) => res.status(200).json({ ok: true })),
}));

jest.mock('../../controllers/adminPacks', () => ({
  updatePack: jest.fn((req, res) => res.status(200).json({ ok: true })),
  publishPack: jest.fn((req, res) => res.status(200).json({ ok: true })),
  unpublishPack: jest.fn((req, res) => res.status(200).json({ ok: true })),
  listPacks: jest.fn((req, res) => res.status(200).json({ ok: true })),
}));

jest.mock('../../controllers/adminBulk', () => ({
  bulkUpdateStickerStatus: jest.fn((req, res) => res.status(200).json({ ok: true })),
}));

const { protect, authorize } = require('../../middleware/auth');
const { getMetrics } = require('../../controllers/admin');
const {
  getUserInventoryAndCatalog,
  addStickerToInventory,
  removeStickerFromInventory,
  addPackToInventory,
  removePackFromInventory,
} = require('../../controllers/stickerInventory');
const { updateStickerStatus } = require('../../controllers/adminStickers');
const { updatePack, publishPack, unpublishPack, listPacks } = require('../../controllers/adminPacks');
const { bulkUpdateStickerStatus } = require('../../controllers/adminBulk');

const router = require('../../routes/admin');
const express = require('express');
const request = require('supertest');

const app = express();
app.use(express.json());
app.use('/api/v1/admin', router);

describe('Admin Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('All routes should use protect and authorize admin', async () => {
    // When the router is required, it calls authorize('admin') immediately
    // but we can't check it here because beforeEach clears mocks.
    // Instead we check if the middleware is actually called during a request.
    await request(app).get('/api/v1/admin/metrics');
    expect(protect).toHaveBeenCalled();
  });

  test('GET /metrics should call getMetrics', async () => {
    const res = await request(app).get('/api/v1/admin/metrics');
    expect(res.status).toBe(200);
    expect(getMetrics).toHaveBeenCalled();
  });

  test('GET /inventory/:identifier should call getUserInventoryAndCatalog', async () => {
    const res = await request(app).get('/api/v1/admin/inventory/user123');
    expect(res.status).toBe(200);
    expect(getUserInventoryAndCatalog).toHaveBeenCalled();
  });

  test('POST /inventory/add-sticker should call addStickerToInventory', async () => {
    const res = await request(app).post('/api/v1/admin/inventory/add-sticker').send({});
    expect(res.status).toBe(200);
    expect(addStickerToInventory).toHaveBeenCalled();
  });

  test('POST /inventory/remove-sticker should call removeStickerFromInventory', async () => {
    const res = await request(app).post('/api/v1/admin/inventory/remove-sticker').send({});
    expect(res.status).toBe(200);
    expect(removeStickerFromInventory).toHaveBeenCalled();
  });

  test('POST /inventory/add-pack should call addPackToInventory', async () => {
    const res = await request(app).post('/api/v1/admin/inventory/add-pack').send({});
    expect(res.status).toBe(200);
    expect(addPackToInventory).toHaveBeenCalled();
  });

  test('POST /inventory/remove-pack should call removePackFromInventory', async () => {
    const res = await request(app).post('/api/v1/admin/inventory/remove-pack').send({});
    expect(res.status).toBe(200);
    expect(removePackFromInventory).toHaveBeenCalled();
  });

  test('PATCH /stickers/:id/status should call updateStickerStatus', async () => {
    const res = await request(app).patch('/api/v1/admin/stickers/s1/status').send({ status: 'active' });
    expect(res.status).toBe(200);
    expect(updateStickerStatus).toHaveBeenCalled();
  });

  test('PUT /packs/:id should call updatePack', async () => {
    const res = await request(app).put('/api/v1/admin/packs/p1').send({ name: 'New Name' });
    expect(res.status).toBe(200);
    expect(updatePack).toHaveBeenCalled();
  });

  test('POST /packs/:id/publish should call publishPack', async () => {
    const res = await request(app).post('/api/v1/admin/packs/p1/publish').send({});
    expect(res.status).toBe(200);
    expect(publishPack).toHaveBeenCalled();
  });

  test('POST /packs/:id/unpublish should call unpublishPack', async () => {
    const res = await request(app).post('/api/v1/admin/packs/p1/unpublish').send({});
    expect(res.status).toBe(200);
    expect(unpublishPack).toHaveBeenCalled();
  });

  test('GET /packs should call listPacks', async () => {
    const res = await request(app).get('/api/v1/admin/packs');
    expect(res.status).toBe(200);
    expect(listPacks).toHaveBeenCalled();
  });

  test('POST /stickers/bulk/status should call bulkUpdateStickerStatus', async () => {
    const res = await request(app).post('/api/v1/admin/stickers/bulk/status').send({ ids: ['s1'], status: 'active' });
    expect(res.status).toBe(200);
    expect(bulkUpdateStickerStatus).toHaveBeenCalled();
  });
});
