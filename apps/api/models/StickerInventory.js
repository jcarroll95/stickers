const mongoose = require('mongoose');

const StickerInventorySchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    stickerId: { type: mongoose.Schema.Types.ObjectId, ref: 'StickerDefinition'},
    packId: { type: mongoose.Schema.Types.ObjectId, ref: 'StickerPack'},
    quantity: { type: Number, default: 0, required: true, min: 0 },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
});

// Compound index for efficient lookups
StickerInventorySchema.index({ userId: 1, stickerId: 1 }, { unique: true });

module.exports = mongoose.models.StickerInventory || mongoose.model('StickerInventory', StickerInventorySchema);