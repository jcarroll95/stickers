// apps/api/usecases/inventory/adminInventoryUsecases.js

const ErrorResponse = require('../../utils/errorResponse');

const StickerInventory = require('../../models/StickerInventory');
const StickerDefinition = require('../../models/StickerDefinition');
const StickerPack = require('../../models/StickerPack');
const User = require('../../models/User');

const { isMongoObjectIdLike, normalizeEmail } = require('../../domain/identifiers/resolveUserIdentifier');

/**
 * @param {{ identifier: string }} args
 * @returns {Promise<{ user: any, inventory: any[], catalog: { packs: any[], stickers: any[] } }>}
 */
async function getUserInventoryAndCatalog({ identifier }) {
  if (!identifier) throw new ErrorResponse('Identifier is required', 400);

  // Find user by ID or Email
  let user = null;
  if (isMongoObjectIdLike(identifier)) {
    user = await User.findById(identifier);
  }
  if (!user) {
    user = await User.findOne({ email: normalizeEmail(identifier) });
  }

  if (!user) {
    throw new ErrorResponse(`User not found with identifier of ${identifier}`, 404);
  }

  // Get user inventory
  const inventory = await StickerInventory.find({ userId: user._id }).populate('stickerId');

  // Get full catalog
  const packs = await StickerPack.find().populate('stickers');
  const stickers = await StickerDefinition.find();

  return {
    user: { _id: user._id, name: user.name, email: user.email },
    inventory,
    catalog: { packs, stickers },
  };
}

/**
 * @param {{ userId: string, stickerId: string, quantity?: number }} args
 * @returns {Promise<any>} updated inventory entry
 */
async function addStickerToInventory({ userId, stickerId, quantity = 1 }) {
  if (!userId || !stickerId) throw new ErrorResponse('userId and stickerId are required', 400);

  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) throw new ErrorResponse('quantity must be a positive number', 400);

  let inventoryEntry = await StickerInventory.findOne({ userId, stickerId });

  if (inventoryEntry) {
    inventoryEntry.quantity += qty;

    // Ensure packId is set for existing entries
    if (!inventoryEntry.packId) {
      const stickerDef = await StickerDefinition.findById(stickerId);
      if (stickerDef?.packId) inventoryEntry.packId = stickerDef.packId;
    }

    inventoryEntry.updatedAt = Date.now();
    await inventoryEntry.save();
    return inventoryEntry;
  }

  const stickerDef = await StickerDefinition.findById(stickerId);

  inventoryEntry = await StickerInventory.create({
    userId,
    stickerId,
    packId: stickerDef ? stickerDef.packId : null,
    quantity: qty,
  });

  return inventoryEntry;
}

/**
 * @param {{ userId: string, stickerId: string, quantity?: number }} args
 * @returns {Promise<{ deleted: boolean }>}
 */
async function removeStickerFromInventory({ userId, stickerId, quantity = 1 }) {
  if (!userId || !stickerId) throw new ErrorResponse('userId and stickerId are required', 400);

  const qty = Number(quantity);
  if (!Number.isFinite(qty) || qty <= 0) throw new ErrorResponse('quantity must be a positive number', 400);

  const inventoryEntry = await StickerInventory.findOne({ userId, stickerId });

  if (!inventoryEntry) {
    throw new ErrorResponse('Sticker not found in user inventory', 404);
  }

  inventoryEntry.quantity -= qty;
  if (inventoryEntry.quantity <= 0) {
    await inventoryEntry.deleteOne();
    return { deleted: true };
  }

  inventoryEntry.updatedAt = Date.now();
  await inventoryEntry.save();
  return { deleted: false };
}

/**
 * @param {{ userId: string, packId: string }} args
 * @returns {Promise<void>}
 */
async function addPackToInventory({ userId, packId }) {
  if (!userId || !packId) throw new ErrorResponse('userId and packId are required', 400);

  const pack = await StickerPack.findById(packId);
  if (!pack) throw new ErrorResponse('Sticker pack not found', 404);

  // Upsert + increment each sticker entry
  const now = Date.now();
  const operations = pack.stickers.map((stickerId) => ({
    updateOne: {
      filter: { userId, stickerId },
      update: {
        $inc: { quantity: 1 },
        $set: {
          updatedAt: now,
          packId: packId,
        },
        $setOnInsert: { createdAt: now },
      },
      upsert: true,
    },
  }));

  await StickerInventory.bulkWrite(operations);
}

/**
 * @param {{ userId: string, packId: string }} args
 * @returns {Promise<void>}
 */
async function removePackFromInventory({ userId, packId }) {
  if (!userId || !packId) throw new ErrorResponse('userId and packId are required', 400);

  const pack = await StickerPack.findById(packId);
  if (!pack) throw new ErrorResponse('Sticker pack not found', 404);

  const now = Date.now();
  const operations = pack.stickers.map((stickerId) => ({
    updateOne: {
      filter: { userId, stickerId, quantity: { $gt: 0 } },
      update: {
        $inc: { quantity: -1 },
        $set: { updatedAt: now },
      },
    },
  }));

  await StickerInventory.bulkWrite(operations);

  // Clean up <= 0
  await StickerInventory.deleteMany({ userId, quantity: { $lte: 0 } });
}

module.exports = {
  getUserInventoryAndCatalog,
  addStickerToInventory,
  removeStickerFromInventory,
  addPackToInventory,
  removePackFromInventory,
};
