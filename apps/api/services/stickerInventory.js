const StickerInventory = require('../models/StickerInventory');
const StickerDefinition = require('../models/StickerDefinition');
const StickerPack = require('../models/StickerPack');
const User = require('../models/User');

/**
 * Get user's inventory for a specific sticker
 * @param {ObjectId} userId
 * @param {ObjectId} stickerId - StickerDefinition ID
 * @returns {Promise<Object|null>}
 */
async function getUserInventory(userId, stickerId) {
    return await StickerInventory.findOne({ userId, stickerId });
}

/**
 * Get all stickers in user's inventory
 * @param {ObjectId} userId
 * @returns {Promise<Array>}
 */
async function getAllUserInventory(userId) {
    return await StickerInventory.find({ userId })
        .populate('stickerId')
        .sort({ createdAt: -1 });
}

/**
 * Check if user has sufficient quantity of a sticker
 * @param {ObjectId} userId
 * @param {ObjectId|Number} stickerIdOrLegacyId - Can be StickerDefinition _id or legacy numeric ID
 * @returns {Promise<Boolean>}
 */
async function hasSticker(userId, stickerIdOrLegacyId) {
    // Check new system first
    if (typeof stickerIdOrLegacyId === 'object') {
        const inventory = await StickerInventory.findOne({
            userId,
            stickerId: stickerIdOrLegacyId,
            quantity: { $gte: 1 }
        });
        if (inventory) return true;
    }

    // Fallback to legacy system (User.cheersStickers array)
    if (typeof stickerIdOrLegacyId === 'number') {
        const user = await User.findById(userId).select('cheersStickers');
        if (user && user.cheersStickers && user.cheersStickers.includes(stickerIdOrLegacyId)) {
            return true;
        }
    }

    return false;
}

/**
 * Atomically consume (decrement) a sticker from user's inventory
 * @param {ObjectId} userId
 * @param {ObjectId} stickerId - StickerDefinition ID
 * @param {String} opId - Operation ID for tracking
 * @returns {Promise<Object>} Updated inventory or null if insufficient quantity
 */
async function consumeSticker(userId, stickerId, opId) {
    // Atomic decrement with condition
    const updated = await StickerInventory.findOneAndUpdate(
        {
            userId,
            stickerId,
            quantity: { $gte: 1 } // Only decrement if quantity is at least 1
        },
        {
            $inc: { quantity: -1 },
            $set: { updatedAt: Date.now() }
        },
        { new: true }
    );

    if (!updated) {
        // Try legacy system as fallback
        const legacyStickerId = await mapStickerDefinitionToLegacyId(stickerId);
        if (legacyStickerId !== null) {
            const user = await User.findById(userId).select('cheersStickers');
            if (user && user.cheersStickers) {
                const idx = user.cheersStickers.indexOf(legacyStickerId);
                if (idx !== -1) {
                    user.cheersStickers.splice(idx, 1);
                    await user.save();
                    return { legacy: true, stickerId: legacyStickerId };
                }
            }
        }
    }

    return updated;
}

/**
 * Grant (add) stickers to user's inventory
 * @param {ObjectId} userId
 * @param {ObjectId} stickerId - StickerDefinition ID
 * @param {Number} quantity - Amount to add
 * @returns {Promise<Object>}
 */
async function grantSticker(userId, stickerId, quantity = 1) {
    const updated = await StickerInventory.findOneAndUpdate(
        { userId, stickerId },
        {
            $inc: { quantity: quantity },
            $set: { updatedAt: Date.now() }
        },
        { upsert: true, new: true }
    );

    return updated;
}

/**
 * Get user's inventory grouped by pack
 * @param {ObjectId} userId
 * @returns {Promise<Object>} Packs with their stickers and quantities
 */
async function getUserPackInventory(userId) {
    const inventory = await StickerInventory.find({ userId, quantity: { $gt: 0 } })
        .populate({
            path: 'stickerId',
            populate: { path: 'packId' }
        });

    const packMap = {};
    const unpackedStickers = [];

    inventory.forEach(item => {
        if (item.stickerId && item.stickerId.packId) {
            const packId = item.stickerId.packId._id.toString();
            if (!packMap[packId]) {
                packMap[packId] = {
                    pack: item.stickerId.packId,
                    stickers: []
                };
            }
            packMap[packId].stickers.push({
                sticker: item.stickerId,
                quantity: item.quantity
            });
        } else if (item.stickerId) {
            unpackedStickers.push({
                sticker: item.stickerId,
                quantity: item.quantity
            });
        }
    });

    return {
        packs: Object.values(packMap),
        unpacked: unpackedStickers
    };
}

/**
 * Helper to map StickerDefinition ID to legacy numeric ID (0-9)
 * @param {ObjectId} stickerId
 * @returns {Promise<Number|null>}
 */
async function mapStickerDefinitionToLegacyId(stickerId) {
    const sticker = await StickerDefinition.findById(stickerId);
    // Assuming legacy stickers have a metadata field or we can derive from slug
    // This is a placeholder - adjust based on your actual mapping strategy
    if (sticker && sticker.metadata && typeof sticker.metadata.legacyId === 'number') {
        return sticker.metadata.legacyId;
    }
    return null;
}

/**
 * Assign a random starter pack to a new user
 * @param {ObjectId} userId
 * @returns {Promise<Number|null>}
 */
async function assignStarterPackToUser(userId) {
    try {
        // Find all starter packs
        const starterPacks = await StickerPack.find({ theme: 'Starter' })
            .populate('stickers', '_id') // Only populate sticker IDs, not full objects
            .sort({ createdAt: 1 }); // Sort by creation date for consistent ordering

        // If no starter packs exist, return null
        if (!starterPacks || starterPacks.length === 0) {
            console.warn('No starter packs found for user:', userId);
            return null;
        }

        // Randomly select one starter pack
        const randomIndex = Math.floor(Math.random() * starterPacks.length);
        const selectedPack = starterPacks[randomIndex];

        // Get all sticker IDs from the selected pack
        const stickerIds = selectedPack.stickers.map(sticker => sticker._id);

        // Grant each sticker from the pack to the user
        const grantPromises = stickerIds.map(stickerId =>
            grantSticker(userId, stickerId, 1)
        );

        // Wait for all grants to complete
        await Promise.all(grantPromises);

        // Return information about the assigned pack
        return {
            packId: selectedPack._id,
            packName: selectedPack.name,
            stickerCount: stickerIds.length,
            assignedAt: new Date()
        };

    } catch (error) {
        console.error('Error assigning starter pack to user:', userId, error);
        throw new Error(`Failed to assign starter pack: ${error.message}`);
    }
}

module.exports = {
    getUserInventory,
    getAllUserInventory,
    hasSticker,
    consumeSticker,
    grantSticker,
    getUserPackInventory,
    mapStickerDefinitionToLegacyId,
    assignStarterPackToUser
};
