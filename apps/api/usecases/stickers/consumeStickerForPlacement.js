// usecases/stickers/consumeStickerForPlacement.js

const ErrorResponse = require('../../utils/errorResponse');
const User = require('../../models/User');
const StickerInventory = require('../../models/StickerInventory');

/**
 * Consume one "Cheers" sticker for a non-owner placement.
 * Supports:
 *  - legacy numeric stickerId stored in user.cheersStickers (array)
 *  - inventory stickerId stored in StickerInventory (ObjectId string)
 *
 * @param {{ userId: string, stickerId: number|string, sessionOpt?: { session?: any } }} args
 * @returns {Promise<{ consumed: true, mode: 'legacy'|'inventory' }>}
 * @throws {ErrorResponse}
 */
async function consumeCheersStickerForNonOwner({ userId, stickerId, sessionOpt = {} }) {
  const session = sessionOpt.session;

  // Legacy numeric ID path
  if (typeof stickerId === 'number') {
    const user = await User.findById(userId).session(session || null);
    if (!user) throw new ErrorResponse('User not found', 404);

    const idx = user.cheersStickers.indexOf(stickerId);
    if (idx === -1) {
      throw new ErrorResponse('User does not have the required sticker', 400);
    }

    user.cheersStickers.splice(idx, 1);
    await user.save(sessionOpt);
    return { consumed: true, mode: 'legacy' };
  }

  // Inventory ObjectId string path
  if (typeof stickerId === 'string' && stickerId.match(/^[0-9a-fA-F]{24}$/)) {
    const inventoryEntry = await StickerInventory.findOne({
      userId,
      stickerId,
    }).session(session || null);

    if (!inventoryEntry || inventoryEntry.quantity <= 0) {
      throw new ErrorResponse('User does not have the required sticker', 400);
    }

    inventoryEntry.quantity -= 1;
    inventoryEntry.updatedAt = new Date();
    await inventoryEntry.save(sessionOpt);

    return { consumed: true, mode: 'inventory' };
  }

  // Anything else is invalid upstream
  throw new ErrorResponse('Invalid stickerId type', 400);
}

/**
 * If an owner is appending exactly one inventory sticker, decrement inventory.
 * If inventory is missing and actor is not admin, throw.
 *
 * @param {{
 *   userId: string,
 *   isAdmin: boolean,
 *   existingStickersLength: number,
 *   updatedStickers: any,
 *   sessionOpt?: { session?: any }
 * }} args
 *
 * @returns {Promise<{ consumed: boolean }>}
 * @throws {ErrorResponse}
 */
async function consumeInventoryStickerIfAppending({
                                                    userId,
                                                    isAdmin,
                                                    existingStickersLength,
                                                    updatedStickers,
                                                    sessionOpt = {},
                                                  }) {
  if (!Array.isArray(updatedStickers)) return { consumed: false };
  if (typeof existingStickersLength !== 'number') return { consumed: false };

  const isAppending = updatedStickers.length === existingStickersLength + 1;
  if (!isAppending) return { consumed: false };

  const newSticker = updatedStickers[updatedStickers.length - 1];
  const stickerId = newSticker?.stickerId;

  // Only inventory stickers have ObjectId strings in your current design
  const isInventoryId = typeof stickerId === 'string' && stickerId.match(/^[0-9a-fA-F]{24}$/);
  if (!isInventoryId) return { consumed: false };

  const session = sessionOpt.session;

  const inventoryEntry = await StickerInventory.findOne({
    userId,
    stickerId,
  }).session(session || null);

  if (inventoryEntry && inventoryEntry.quantity > 0) {
    inventoryEntry.quantity -= 1;
    inventoryEntry.updatedAt = new Date();
    await inventoryEntry.save(sessionOpt);
    return { consumed: true };
  }

  // Only admins can place stickers they don't have
  if (!isAdmin) {
    throw new ErrorResponse('User does not have the required sticker in inventory', 400);
  }

  return { consumed: false };
}

module.exports = { consumeCheersStickerForNonOwner, consumeInventoryStickerIfAppending };
