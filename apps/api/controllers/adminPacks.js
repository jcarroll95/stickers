// apps/api/controllers/adminPacks.js

const asyncHandler = require('../middleware/async');
const { updatePack } = require('../usecases/admin/packs/updatePack');

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
