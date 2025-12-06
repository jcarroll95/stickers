// Routes for Stickerboard resources
const express = require('express');

const router = express.Router();

// Include outside resource routers and send them to the right place
// eg when this router sees a board id requesting the stix for that board
// when the requested resource is /api/v1/stickerboards/9348f093fh3897fh3/stix, then
// the stick router will handle it
const stickRouter = require('./stix');
router.use('/:belongsToBoard/stix', stickRouter)

// Bring in controller functions
const {
  getStickerboards,
  getStickerboard,
  createStickerboard,
  updateStickerboard,
  deleteStickerboard,
  stickerboardPhotoUpload
} = require('../controllers/stickerboard');

const Stickerboard = require('../models/Stickerboard');
const advancedResults = require('../middleware/advancedResults');

// Map routes to controller actions
router.route('/')
  .get(advancedResults(Stickerboard, 'stix'), getStickerboards)
  .post(createStickerboard);

router.route('/:id')
  .get(getStickerboard)
  .put(updateStickerboard)
  .delete(deleteStickerboard);

router.route('/:id/photo')
    .put(stickerboardPhotoUpload);

module.exports = router;

