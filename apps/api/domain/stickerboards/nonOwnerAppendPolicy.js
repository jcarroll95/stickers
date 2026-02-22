// domain/stickerboards/nonOwnerAppendPolicy.js

const { DomainError } = require('../errors/domainError');

/**
 * Non-owner updates policy:
 * - must NOT modify protected board metadata (name, description, tags, photo, etc.)
 * - MUST contain a sticker update ('stickers' or 'sticker')
 * - allows metadata/infrastructure fields like 'opId'
 *
 * @param {object} body
 * @throws {DomainError}
 */
function assertNonOwnerOnlyAppendingSticker(body) {
  if (!body || typeof body !== 'object') {
    throw new DomainError('Invalid request body', 400);
  }

  const updates = Object.keys(body);

  // 1. Ensure they are actually trying to add a sticker
  const hasStickerData = updates.includes('stickers') || updates.includes('sticker');
  if (!hasStickerData) {
    throw new DomainError('Non-owner updates must include sticker data', 400);
  }

  // 2. Define fields that non-owners are NEVER allowed to change
  const protectedFields = ['name', 'description', 'tags', 'photo', 'user', 'slug', 'backgroundFile'];

  // 3. Check if any protected fields are present in the request
  const illegalUpdates = updates.filter(key => protectedFields.includes(key));

  if (illegalUpdates.length > 0) {
    throw new DomainError(
      `Non-owners are not authorized to update: ${illegalUpdates.join(', ')}`,
      403 // Use 403 Forbidden for actual permission issues
    );
  }

  // Note: We changed the status code from 401 to 400/403 to prevent accidental logouts.
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
