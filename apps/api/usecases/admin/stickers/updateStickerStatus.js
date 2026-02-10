// apps/api/usecases/admin/stickers/updateStickerStatus.js

const StickerDefinition = require('../../../models/StickerDefinition');
const { emitAuditEvent } = require('../../../utils/audit');
const ErrorResponse = require('../../../utils/errorResponse');

const {
  assertValidStickerStatus,
  computeStickerStatusChange,
} = require('../../../domain/stickers/statusPolicy');

async function updateStickerStatus({ actor, stickerId, nextStatus, reqForAudit }) {
  assertValidStickerStatus(nextStatus);

  const sticker = await StickerDefinition.findById(stickerId);
  if (!sticker) throw new ErrorResponse('Sticker not found', 404);

  const prevStatus = sticker.status;

  const prev = {
    status: sticker.status,
    reviewedAt: sticker.reviewedAt,
    reviewedBy: sticker.reviewedBy,
    activatedAt: sticker.activatedAt,
    retiredAt: sticker.retiredAt,
  };

  const { now, set, changes } = computeStickerStatusChange({
    prev,
    nextStatus,
    actorUserId: actor?.id,
    now: new Date(),
  });

  // Apply updates
  sticker.status = set.status;
  if (set.reviewedAt) sticker.reviewedAt = now;
  if (Object.prototype.hasOwnProperty.call(set, 'reviewedBy')) sticker.reviewedBy = set.reviewedBy;
  if (set.activatedAt) sticker.activatedAt = now;
  if (set.retiredAt) sticker.retiredAt = now;

  await sticker.save();

  await emitAuditEvent(reqForAudit, {
    entityType: 'StickerDefinition',
    entityId: sticker._id,
    action: 'sticker.status_change',
    changes,
    meta: {
      stickerKey: sticker.stickerKey,
      prevStatus,
      nextStatus,
    },
  });

  return { sticker };
}

module.exports = { updateStickerStatus };
