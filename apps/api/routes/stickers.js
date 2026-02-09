// apps/api/routes/stickers.js

const express = require('express');
const router = express.Router();

const {
  createStickerTransaction,
  revokeStickerTransaction,
  getInventory,
} = require('../controllers/stickerController');

const { protect, authorize } = require('../middleware/auth');

// Award sticker to user (idempotent)
router.post('/award/:userId', protect, authorize('admin'), createStickerTransaction);

// Revoke sticker from user (idempotent)
router.post('/revoke/:userId', protect, authorize('admin'), revokeStickerTransaction);

// Get user's sticker inventory
router.get('/inventory/:userId', protect, authorize('user', 'vipuser', 'admin'), getInventory);

module.exports = router;
