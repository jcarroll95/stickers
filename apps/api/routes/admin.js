const express = require('express');
const router = express.Router();
const { getMetrics } = require('../middleware/performance');
const { protect, authorize } = require('../middleware/auth');
const {
    getUserInventoryAndCatalog,
    addStickerToInventory,
    removeStickerFromInventory,
    addPackToInventory,
    removePackFromInventory
} = require('../controllers/stickerInventory');

// All routes here are for admins only
router.use(protect);
router.use(authorize('admin'));

router.get('/metrics', (req, res) => {
    const metrics = getMetrics();
    res.status(200).json({
        success: true,
        data: metrics
    });
});

router.get('/inventory/:identifier', getUserInventoryAndCatalog);
router.post('/inventory/add-sticker', addStickerToInventory);
router.post('/inventory/remove-sticker', removeStickerFromInventory);
router.post('/inventory/add-pack', addPackToInventory);
router.post('/inventory/remove-pack', removePackFromInventory);

module.exports = router;
