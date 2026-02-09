// apps/api/domain/stickerboards/palette.js

/**
 * Palette selection that supports BOTH:
 *  - legacy numeric palette ids (0..9)
 *  - modern palette sticker ids (StickerDefinition ObjectId strings)
 *
 * The "modern" path is used when paletteStickerIds is provided and non-empty.
 * Otherwise we fall back to legacy numeric behavior.
 */

function isObjectIdString(x) {
  return typeof x === 'string' && /^[0-9a-fA-F]{24}$/.test(x);
}

function toFiniteNumberMaybe(x) {
  const n = Number(x);
  return Number.isFinite(n) ? n : null;
}

/**
 * Choose a palette stickerId.
 *
 * Modern mode (preferred):
 * - paletteStickerIds: array of StickerDefinition ObjectId strings.
 * - if stickNumber numeric-ish -> choose by modulo
 * - else choose first unused from palette list
 *
 * Legacy mode (fallback):
 * - choose number 0..9 by modulo/unused scan
 *
 * @param {{
 *   stickNumber: any,
 *   existingStickers: any[],
 *   paletteStickerIds?: string[]
 * }} args
 *
 * @returns {string|number} stickerId
 */
function choosePaletteStickerId({ stickNumber, existingStickers, paletteStickerIds = [] }) {
  const existing = Array.isArray(existingStickers) ? existingStickers : [];

  // -------- Modern mode --------
  const palette = (paletteStickerIds || []).filter(isObjectIdString);
  if (palette.length > 0) {
    const used = new Set(
      existing
        .map((s) => s?.stickerId)
        .filter((id) => typeof id === 'string')
    );

    const n = toFiniteNumberMaybe(stickNumber);
    if (n !== null) {
      // deterministic mapping: stickNumber -> palette index
      return palette[((n % palette.length) + palette.length) % palette.length];
    }

    // pick first unused palette sticker id
    for (const id of palette) {
      if (!used.has(id)) return id;
    }

    // if all are used, reuse deterministically
    return palette[0];
  }

  // -------- Legacy fallback mode --------
  const usedNums = new Set(
    existing
      .map((s) => (typeof s?.stickerId === 'number' ? s.stickerId : null))
      .filter((n) => n != null)
  );

  const n = toFiniteNumberMaybe(stickNumber);
  if (n !== null) {
    return ((n % 10) + 10) % 10;
  }

  for (let i = 0; i <= 9; i++) {
    if (!usedNums.has(i)) return i;
  }
  return 0;
}

/**
 * Build the palette sticker object pushed onto Stickerboard.stickers.
 * Works for both stickerId types (number or ObjectId string).
 *
 * @param {{ stickerId: string|number, now?: Date }} args
 */
function buildPaletteSticker({ stickerId, now = new Date() }) {
  return {
    stickerId,
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0,
    zIndex: 0,
    stuck: false,
    createdAt: now,
  };
}

module.exports = { choosePaletteStickerId, buildPaletteSticker };
