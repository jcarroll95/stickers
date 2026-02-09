// domain/stickers/buildCheersSticker.js

/**
 * Constructs a validated Cheers sticker object from raw seed data.
 * Pure function: no DB, no req/res, time is injectable.
 *
 * @param {Object} input
 * @param {{ now?: Date }} opts
 * @returns {Object|null}
 */
function buildCheersSticker(input, { now = new Date() } = {}) {
  if (!input || typeof input !== 'object') return null;

  // stickerId can be Number (legacy) or ObjectId string (new inventory)
  let stickerId = input.stickerId;
  if (typeof stickerId === 'string' && !stickerId.match(/^[0-9a-fA-F]{24}$/)) {
    stickerId = Number(stickerId);
  }

  const x = Number(input.x);
  const y = Number(input.y);

  const isValidId =
    (typeof stickerId === 'number' && Number.isFinite(stickerId)) ||
    (typeof stickerId === 'string' && stickerId.match(/^[0-9a-fA-F]{24}$/));

  if (!isValidId || !Number.isFinite(x) || !Number.isFinite(y)) return null;

  return {
    stickerId,
    imageUrl: input.imageUrl,
    name: input.name,
    x,
    y,
    scale: Number.isFinite(Number(input.scale)) ? Number(input.scale) : 1,
    rotation: Number.isFinite(Number(input.rotation)) ? Number(input.rotation) : 0,
    zIndex: Number.isFinite(Number(input.zIndex)) ? Number(input.zIndex) : 0,
    stuck: true,
    isCheers: true,
    createdAt: now,
  };
}

module.exports = { buildCheersSticker };
