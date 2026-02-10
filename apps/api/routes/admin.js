// apps/api/routes/admin.js

const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../middleware/auth');
const { getMetrics } = require('../controllers/admin');

const {
  getUserInventoryAndCatalog,
  addStickerToInventory,
  removeStickerFromInventory,
  addPackToInventory,
  removePackFromInventory,
} = require('../controllers/stickerInventory');

// New thin admin controllers (status/packs/bulk)
const { updateStickerStatus } = require('../controllers/adminStickers');
const { updatePack } = require('../controllers/adminPacks');
const { bulkUpdateStickerStatus } = require('../controllers/adminBulk');

// All routes here are for admins only
router.use(protect);
router.use(authorize('admin'));

// Metrics
router.get('/metrics', getMetrics);

// Inventory admin
router.get('/inventory/:identifier', getUserInventoryAndCatalog);
router.post('/inventory/add-sticker', addStickerToInventory);
router.post('/inventory/remove-sticker', removeStickerFromInventory);
router.post('/inventory/add-pack', addPackToInventory);
router.post('/inventory/remove-pack', removePackFromInventory);

/**
 * Sticker catalog moderation / lifecycle
 * Adjust these paths if you already have established endpoints.
 */

// Update a single sticker status
// Example: PATCH /api/v1/admin/stickers/:id/status  { status: 'ready'|'active'|'retired'|'staged' }
router.patch('/stickers/:id/status', updateStickerStatus);

// Update pack metadata
// Example: PUT /api/v1/admin/packs/:id  { name?, description? }
router.put('/packs/:id', updatePack);

// Bulk status update
// Example: POST /api/v1/admin/stickers/bulk/status  { ids: [...], status: 'active' }
router.post('/stickers/bulk/status', bulkUpdateStickerStatus);

module.exports = router;
