// apps/api/controllers/stickerController.js

const asyncHandler = require('../middleware/async');

const { awardSticker, revokeSticker } = require('../usecases/stickers/stickerTransactions');
const { getUserInventory } = require('../usecases/stickers/getUserInventory');

/**
 * Award sticker to user (idempotent by opId).
 * Route: POST /api/v1/stickers/award/:userId
 * Body: { stickerId, opId }
 */
exports.createStickerTransaction = asyncHandler(async (req, res) => {
  const userId = req.params.userId || req.body.userId;
  const { stickerId, opId } = req.body;

  const { result, message } = await awardSticker({ userId, stickerId, opId });

  res.json({
    success: true,
    message,
    data: result,
  });
});

/**
 * Revoke sticker from user (idempotent by opId).
 * Route: POST /api/v1/stickers/revoke/:userId
 * Body: { stickerId, opId }
 */
exports.revokeStickerTransaction = asyncHandler(async (req, res) => {
  const userId = req.params.userId || req.body.userId;
  const { stickerId, opId } = req.body;

  const { result, message } = await revokeSticker({ userId, stickerId, opId });

  res.json({
    success: true,
    message,
    data: result,
  });
});

/**
 * Get user's sticker inventory (frontend-friendly shape)
 * Route: GET /api/v1/stickers/inventory/:userId
 */
exports.getInventory = asyncHandler(async (req, res) => {
  const userId = req.params.userId;

  const { items } = await getUserInventory({ userId });

  // Preserve legacy response shape expected by the frontend:
  // previously route returned res.json(transformedInventory)
  res.status(200).json(items);
});

