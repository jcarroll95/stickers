// domain/stickerboards/pickAllowedBoardFields.js

/**
 * Field allowlist for board metadata updates (owner/admin path).
 * @param {object} body
 * @param {string[]} allowedFields
 * @returns {object} updateData
 */
function pickAllowedBoardFields(
  body,
  allowedFields = ['name', 'description', 'tags', 'photo', 'stickers']
) {
  const updateData = {};
  for (const f of allowedFields) {
    if (body?.[f] !== undefined) updateData[f] = body[f];
  }
  return updateData;
}

module.exports = { pickAllowedBoardFields };
