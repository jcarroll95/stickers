// apps/api/usecases/admin/packs/listPacks.js

const StickerPack = require('../../../models/StickerPack');

async function listPacks({ limit = 100 }) {
  const n = Math.max(1, Math.min(Number(limit) || 100, 500));

  const packs = await StickerPack.find({})
    .sort({ updatedAt: -1 })
    .limit(n)
    .lean();

  return packs.map((p) => ({
    id: String(p._id),
    slug: p.slug,
    name: p.name,
    description: p.description,
    isActive: !!p.isActive,
    stickersCount: Array.isArray(p.stickers) ? p.stickers.length : 0,

    // Operational transparency
    lastIngestBatchId: p.lastIngestBatchId || null,
    lastIngestManifestDigest: p.lastIngestManifestDigest || null,
    lastIngestedAt: p.lastIngestedAt || null,

    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  }));
}

module.exports = { listPacks };
