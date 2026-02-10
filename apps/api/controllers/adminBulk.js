// apps/api/controllers/adminBulk.js

const asyncHandler = require('../middleware/async');
const { bulkUpdateStickerStatus } = require('../usecases/admin/stickers/bulkUpdateStickerStatus');

/**
 * POST /api/v1/admin/stickers/bulk/status
 * Body: { ids: string[], status: 'staged'|'ready'|'active'|'retired' }
 */
exports.bulkUpdateStickerStatus = asyncHandler(async (req, res) => {
  const actor = { id: req.user?._id || req.user?.id, role: req.user?.role };

  const { matched, modified, beforeCounts } = await bulkUpdateStickerStatus({
    actor,
    ids: req.body?.ids,
    nextStatus: req.body?.status,
    reqForAudit: req,
  });

  res.json({ ok: true, matched, modified, beforeCounts });
});
