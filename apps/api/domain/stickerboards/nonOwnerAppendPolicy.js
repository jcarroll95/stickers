// domain/stickerboards/nonOwnerAppendPolicy.js

const { DomainError } = require('../errors/domainError');

/**
 * Non-owner updates policy:
 * - must ONLY be adding a sticker
 * - payload must be exactly one key: "stickers" or "sticker"
 * @param {object} body
 * @throws {DomainError}
 */
function assertNonOwnerOnlyAppendingSticker(body) {
  const updates = Object.keys(body || {});
  const isOnlyStickers =
    updates.length === 1 && (updates[0] === 'stickers' || updates[0] === 'sticker');

  if (!isOnlyStickers) {
    throw new DomainError('Non-owner updates may only append a sticker', 401);
  }
}

/**
 * Extract the candidate sticker from a non-owner request body.
 *
 * Supports two shapes:
 *  - { stickers: [...existing..., newSticker] }  (append-only enforced)
 *  - { sticker: newSticker }
 *
 * @param {{ body: object, existingStickerCount: number }} args
 * @returns {object} candidateStickerSeed
 * @throws {DomainError}
 */
function extractCandidateSticker({ body, existingStickerCount }) {
  if (!body || typeof body !== 'object') {
    throw new DomainError('Invalid request body', 400);
  }

  if (Array.isArray(body.stickers)) {
    if (typeof existingStickerCount !== 'number') {
      throw new DomainError('existingStickerCount is required', 500);
    }

    if (body.stickers.length <= existingStickerCount) {
      throw new DomainError('Invalid stickers update: must append a sticker', 400);
    }

    return body.stickers[body.stickers.length - 1];
  }

  if (body.sticker && typeof body.sticker === 'object') {
    return body.sticker;
  }

  throw new DomainError('Invalid stickers update: missing sticker data', 400);
}

module.exports = { assertNonOwnerOnlyAppendingSticker, extractCandidateSticker };
