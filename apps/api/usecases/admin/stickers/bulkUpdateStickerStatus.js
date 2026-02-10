// apps/api/usecases/admin/stickers/bulkUpdateStickerStatus.js

const mongoose = require('mongoose');
const StickerDefinition = require('../../../models/StickerDefinition');
const { emitAuditEvent } = require('../../../utils/audit');
const ErrorResponse = require('../../../utils/errorResponse');

const { assertValidStickerStatus } = require('../../../domain/stickers/statusPolicy');

async function bulkUpdateStickerStatus({ actor, ids, nextStatus, reqForAudit }) {
  if (!Array.isArray(ids) || ids.length === 0) {
    throw new ErrorResponse('ids must be a non-empty array', 400);
  }

  assertValidStickerStatus(nextStatus);

  const objectIds = ids.map((x) => new mongoose.Types.ObjectId(x));
  const now = new Date();

  const stickers = await StickerDefinition.find(
    { _id: { $in: objectIds } },
    { _id: 1, stickerKey: 1, status: 1 }
  );

  const beforeCounts = stickers.reduce((acc, s) => {
    acc[s.status] = (acc[s.status] || 0) + 1;
    return acc;
  }, {});

  const set = { status: nextStatus };
  if (nextStatus === 'ready') {
    set.reviewedAt = now;
    set.reviewedBy = actor?.id || null;
  }
  if (nextStatus === 'active') set.activatedAt = now;
  if (nextStatus === 'retired') set.retiredAt = now;

  const result = await StickerDefinition.updateMany(
    { _id: { $in: objectIds } },
    { $set: set }
  );

  await emitAuditEvent(reqForAudit, {
    entityType: 'System',
    entityId: null,
    action: 'sticker.bulk_status_change',
    changes: [{ path: 'status', before: 'mixed', after: nextStatus }],
    meta: {
      nextStatus,
      actorUserId: actor?.id || null,
      matched: result.matchedCount ?? result.n ?? undefined,
      modified: result.modifiedCount ?? result.nModified ?? undefined,
      beforeCounts,
      stickerKeysSample: stickers.slice(0, 20).map((s) => s.stickerKey),
      stickerIds: ids.length <= 200 ? ids : ids.slice(0, 200), // cap for audit safety
    },
  });

  return {
    matched: result.matchedCount ?? result.n,
    modified: result.modifiedCount ?? result.nModified,
    beforeCounts,
  };
}

module.exports = { bulkUpdateStickerStatus };
