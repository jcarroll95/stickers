// Routes for Stickerboard resources
const express = require('express');
const router = express.Router();

// Bring in controller functions
const {
  getStickerboards,
  getStickerboard,
  createStickerboard,
  updateStickerboard,
  deleteStickerboard,
} = require('../controllers/stickerboard');

// Map routes to controller actions
router.route('/')
  .get(getStickerboards)
  .post(createStickerboard);

router.route('/:id')
  .get(getStickerboard)
  .put(updateStickerboard)
  .delete(deleteStickerboard);

module.exports = router;

