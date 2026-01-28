// Routes for Stick resources
const express = require('express');

const router = express.Router( { mergeParams: true });

const { protect, authorize } = require('../middleware/auth');
const { idempotencyMiddleware } = require('../middleware/idempotency');

// Bring in controller functions
const {
    getStix,
    getStick,
    addStick,
    updateStick,
    deleteStick
} = require('../controllers/stick');

const Stick = require('../models/Stick');
const advancedResults = require('../middleware/advancedResults');

// Map routes to controller actions
router.route('/')
    .get(advancedResults(Stick, { path: 'stickerboard', select: 'name description', strictPopulate: false }), getStix)
    .post(protect, idempotencyMiddleware('placeSticker'), addStick);
//    .post(createStickerboard);

router.route('/:belongsToBoard')
    .post(protect, idempotencyMiddleware('placeSticker'), addStick);

router.route('/:stickId')
    .get(getStick)
    .put(protect, updateStick);
    //.post(addStick)
    //.put(updateStickerboard)
    //.delete(deleteStickerboard);

module.exports = router;
