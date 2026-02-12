// apps/api/routes/admin.js

const express = require('express');
const router = express.Router();

const { protect, authorize } = require('../middleware/auth');
const { getMetrics } = require('../controllers/admin');
const { getBatchStatus, listBatches } = require('../controllers/adminIngestionStatus');

const {
  getUserInventoryAndCatalog,
  addStickerToInventory,
  removeStickerFromInventory,
  addPackToInventory,
  removePackFromInventory,
} = require('../controllers/stickerInventory');

// thin admin controllers
const { updateStickerStatus } = require('../controllers/adminStickers');
const { updatePack, publishPack, unpublishPack, listPacks } = require('../controllers/adminPacks');
const { bulkUpdateStickerStatus } = require('../controllers/adminBulk');
const { ingestBatch, validateBatch } = require('../controllers/adminIngest');

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
 */

// Update a single sticker status
router.patch('/stickers/:id/status', updateStickerStatus);

// Update pack metadata
router.put('/packs/:id', updatePack);

// Pack publish lifecycle (pack+sticker gating)
router.post('/packs/:id/publish', publishPack);
router.post('/packs/:id/unpublish', unpublishPack);

// Bulk status update
router.post('/stickers/bulk/status', bulkUpdateStickerStatus);

// Ingestion pipeline
router.get('/catalog/ingest-batch', listBatches);
router.get('/catalog/ingest-batch/:batchId', getBatchStatus);

router.post('/catalog/ingest-batch', ingestBatch);
router.post('/catalog/ingest-batch/validate', validateBatch);

router.get('/packs', listPacks);

module.exports = router;
