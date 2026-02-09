// apps/api/usecases/stickers/getUserInventory.js

const ErrorResponse = require('../../utils/errorResponse');
const StickerInventory = require('../../models/StickerInventory');

/**
 * Fetch and transform a user's inventory to the frontend-friendly shape.
 * This is application-layer because it does DB + mapping.
 *
 * @param {{ userId: string }} args
 * @returns {Promise<{ items: Array }>}
 */
async function getUserInventory({ userId }) {
  if (!userId) throw new ErrorResponse('userId is required', 400);

  const inventory = await StickerInventory.find({ userId })
    .populate({
      path: 'stickerId',
      populate: {
        path: 'packId',
        model: 'StickerPack',
      },
    })
    .populate('packId');

  const items = inventory
    .map((item) => {
      if (!item.stickerId) return null;

      const pack = item.packId || item.stickerId.packId;
      const packId = pack ? pack._id || pack : 'default';
      const packName = pack ? pack.name : 'Assorted';

      return {
        id: item.stickerId._id,
        name: item.stickerId.name,
        imageUrl: item.stickerId.imageUrl,
        packId,
        packName,
        inventoryId: item._id,
        quantity: item.quantity,
      };
    })
    .filter(Boolean);

  return { items };
}

module.exports = { getUserInventory };
