const express = require('express');
const router = express.Router();
const { createStickerTransaction, revokeStickerTransaction } = require('../controllers/stickerController');
const StickerInventory = require('../models/StickerInventory');

// Award sticker to user (idempotent)
router.post('/award/:userId', createStickerTransaction);

// Revoke sticker from user (idempotent)
router.post('/revoke/:userId', revokeStickerTransaction);

// Get user's sticker inventory
router.get('/inventory/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const inventory = await StickerInventory.find({ userId })
            .populate({
                path: 'stickerId',
                populate: {
                    path: 'packId',
                    model: 'StickerPack'
                }
            })
            .populate('packId');
        
        // Transform to include sticker details at the top level for the frontend
        const transformedInventory = inventory.map(item => {
            if (!item.stickerId) return null;
            
            // Priority: packId from inventory item (populated), or from sticker definition
            const pack = item.packId || item.stickerId.packId;
            const packId = pack ? (pack._id || pack) : 'default';
            const packName = pack ? pack.name : 'Assorted';

            return {
                id: item.stickerId._id,
                name: item.stickerId.name,
                imageUrl: item.stickerId.imageUrl,
                packId: packId,
                packName: packName,
                inventoryId: item._id,
                quantity: item.quantity
            };
        }).filter(item => item !== null);

        res.json(transformedInventory);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;