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

// All routes here are for admins only
router.use(protect);
router.use(authorize('admin'));

router.get('/metrics', getMetrics);

router.get('/inventory/:identifier', getUserInventoryAndCatalog);
router.post('/inventory/add-sticker', addStickerToInventory);
router.post('/inventory/remove-sticker', removeStickerFromInventory);
router.post('/inventory/add-pack', addPackToInventory);
router.post('/inventory/remove-pack', removePackFromInventory);

module.exports = router;
