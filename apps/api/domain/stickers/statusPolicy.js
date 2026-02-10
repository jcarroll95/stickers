const ALLOWED_STICKER_STATUSES = Object.freeze(['staged', 'ready', 'active', 'retired']);

function assertValidStickerStatus(nextStatus) {
  if (!ALLOWED_STICKER_STATUSES.includes(nextStatus)) {
    const err = new Error('Invalid status');
    err.statusCode = 400;
    throw err;
  }
}

/**
 * Pure policy: compute lifecycle field updates + audit diff entries for a status change.
 *
 * @param {{
 *   prev: object,               // minimal sticker snapshot (status + lifecycle fields)
 *   nextStatus: string,
 *   actorUserId?: any,
 *   now?: Date
 * }} args
 */
function computeStickerStatusChange({ prev, nextStatus, actorUserId, now = new Date() }) {
  const changes = [{ path: 'status', before: prev.status, after: nextStatus }];

  const set = { status: nextStatus };

  if (nextStatus === 'ready') {
    set.reviewedAt = now;
    set.reviewedBy = actorUserId || null;

    changes.push({ path: 'reviewedAt', before: prev.reviewedAt, after: now });
    changes.push({ path: 'reviewedBy', before: prev.reviewedBy, after: actorUserId || null });
  }

  if (nextStatus === 'active') {
    set.activatedAt = now;
    changes.push({ path: 'activatedAt', before: prev.activatedAt, after: now });
  }

  if (nextStatus === 'retired') {
    set.retiredAt = now;
    changes.push({ path: 'retiredAt', before: prev.retiredAt, after: now });
  }

  return { now, set, changes };
}

module.exports = {
  ALLOWED_STICKER_STATUSES,
  assertValidStickerStatus,
  computeStickerStatusChange,
};
