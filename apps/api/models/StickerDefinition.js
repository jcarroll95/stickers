const mongoose = require('mongoose');
const slugify = require('slugify');
const { MediaVariantSchema } = require('./MediaVariant');

const StickerDefinitionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    packId: { type: mongoose.Schema.Types.ObjectId, ref: 'StickerPack', required: false },
    slug: { type: String, unique: true, index: true },

    /**
     * stickerKey = stable logical identity across versions
     * revision = monotonic integer version for that stickerKey
     */
    stickerKey: { type: String, index: true },       // e.g. 'happy-frog'
    revision: { type: Number, default: 1, min: 1 },  // 1,2,3...

    status: {
      type: String,
      enum: ['staged', 'ready', 'active', 'retired'],
      default: 'staged',
      index: true,
    },

    rarity: { type: String, enum: ['Common', 'Rare', 'Epic', 'Legendary'], default: 'Common' },
    tags: [{ type: String }],

    metadata: {
      artist: String,
      series: String,
    },

    // Media variants
    media: {
      primaryKey: {
        type: String,
        enum: ['thumb', 'small', 'medium', 'full'],
        default: 'medium',
      },
      variants: {
        type: [MediaVariantSchema],
        default: [],
      },
    },

    replacesStickerId: { type: mongoose.Schema.Types.ObjectId, ref: 'StickerDefinition' },
    supersededByStickerId: { type: mongoose.Schema.Types.ObjectId, ref: 'StickerDefinition' },

    createdAt: { type: Date, default: Date.now, immutable: true },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Keep slug stable unless explicitly unset/changed
StickerDefinitionSchema.pre('validate', function () {
  if (!this.slug && this.name) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
  if (!this.stickerKey) {
    this.stickerKey = this.slug;
  }
});

// Ensure (stickerKey, revision) is unique
StickerDefinitionSchema.index({ stickerKey: 1, revision: 1 }, { unique: true });

// Convenience virtuals (optional) so old code can keep using imageUrl-ish fields
StickerDefinitionSchema.virtual('imageUrl').get(function () {
  const primary = this.media?.primaryKey ?? 'medium';
  const v = this.media?.variants?.find((x) => x.key === primary) || this.media?.variants?.[0];
  return v?.url;
});


StickerDefinitionSchema.virtual('thumbnailUrl').get(function () {
  return this.media?.variants?.find((x) => x.key === 'thumb')?.url;
});
StickerDefinitionSchema.set('toJSON', { virtuals: true });
StickerDefinitionSchema.set('toObject', { virtuals: true });

module.exports =
  mongoose.models.StickerDefinition ||
  mongoose.model('StickerDefinition', StickerDefinitionSchema);
