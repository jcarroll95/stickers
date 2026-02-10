// apps/api/controllers/adminStickers.js

const asyncHandler = require('../middleware/async');
const { updateStickerStatus } = require('../usecases/admin/stickers/updateStickerStatus');

/**
 * PATCH/PUT /api/v1/admin/stickers/:id/status
 * Body: { status }
 */
exports.updateStickerStatus = asyncHandler(async (req, res) => {
  const actor = { id: req.user?._id || req.user?.id, role: req.user?.role };

  const { sticker } = await updateStickerStatus({
    actor,
    stickerId: req.params.id,
    nextStatus: req.body?.status,
    reqForAudit: req,
  });

  res.json({ ok: true, sticker });
});
