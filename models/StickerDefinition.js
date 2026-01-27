const mongoose = require('mongoose');
const slugify = require('slugify');

const StickerDefinitionSchema = new mongoose.Schema({
    name: { type: String, required: true },
    packId: { type: mongoose.Schema.Types.ObjectId, ref: 'StickerPack', required: false },
    slug: { type: String, unique: true },
    imageUrl: { type: String, required: true },
    rarity: { type: String, enum: ['Common', 'Rare', 'Epic', 'Legendary'], default: 'Common' },
    tags: [String],
    metadata: {
        artist: String,
        series: String
    },
    isActive: { type: Boolean, default: true },
    version: { type: String, default: '1.0' },
});

StickerDefinitionSchema.pre('save', function () {
    this.slug = slugify(this.name, { lower: true });
});

module.exports = mongoose.models.StickerDefinition || mongoose.model('StickerDefinition', StickerDefinitionSchema);