// sticker catalog will consist of sticker packs and individual sticker definitions
const mongoose = require('mongoose');
const slugify = require('slugify');

const StickerPackSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String, required: false },
    slug: { type: String, unique: true },
    packType: { type: String, enum: ['Basic', 'Premium', 'Event'] },
    theme: { type: String, enum: ['Holiday', 'Achievement', 'Mood'] },
    stickers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'StickerDefinition' }],
    price: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
    coverStickerId: { type: mongoose.Schema.Types.ObjectId, ref: 'StickerDefinition' }
});

StickerPackSchema.pre('save', function () {
    this.slug = slugify(this.name, { lower: true });
});

module.exports = mongoose.models.StickerPack|| mongoose.model('StickerPack', StickerPackSchema);