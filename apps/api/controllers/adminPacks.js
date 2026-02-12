// apps/api/controllers/adminPacks.js

const asyncHandler = require('../middleware/async');
const { updatePack } = require('../usecases/admin/packs/updatePack');
const { publishPack } = require('../usecases/admin/packs/publishPack');     // you will add
const { unpublishPack } = require('../usecases/admin/packs/unpublishPack'); // you will add
const { listPacks } = require('../usecases/admin/packs/listPacks');

exports.listPacks = asyncHandler(async (req, res) => {
  const actor = { id: req.user?._id || req.user?.id, role: req.user?.role };
  const limit = req.query.limit;

  // actor unused now, but kept for symmetry in later audit reads
  const packs = await listPacks({ limit });

  res.json({ ok: true, packs });
});

/**
 * PUT /api/v1/admin/packs/:id
 * Body: { name?, description? }
 */
exports.updatePack = asyncHandler(async (req, res) => {
  const actor = { id: req.user?._id || req.user?.id, role: req.user?.role };

  const { pack } = await updatePack({
    actor,
    packId: req.params.id,
    updates: req.body,
    reqForAudit: req,
  });

  res.json({ ok: true, pack });
});

/**
 * POST /api/v1/admin/packs/:id/publish
 * Publishes a pack and activates its stickers (pack+sticker gating).
 */
exports.publishPack = asyncHandler(async (req, res) => {
  const actor = { id: req.user?._id || req.user?.id, role: req.user?.role };

  const { pack, stickersActivated } = await publishPack({
    actor,
    packId: req.params.id,
    reqForAudit: req,
  });

  res.json({ ok: true, pack, stickersActivated });
});

/**
 * POST /api/v1/admin/packs/:id/unpublish
 * Unpublishes a pack and deactivates its stickers (pack+sticker gating).
 */
exports.unpublishPack = asyncHandler(async (req, res) => {
  const actor = { id: req.user?._id || req.user?.id, role: req.user?.role };

  const { pack, stickersDeactivated } = await unpublishPack({
    actor,
    packId: req.params.id,
    reqForAudit: req,
  });

  res.json({ ok: true, pack, stickersDeactivated });
});
