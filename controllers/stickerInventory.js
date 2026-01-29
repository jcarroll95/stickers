const StickerInventory = require('../models/StickerInventory');
const StickerDefinition = require('../models/StickerDefinition');
const StickerPack = require('../models/StickerPack');
const User = require('../models/User');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');

// @desc    Get user inventory and full catalog
// @route   GET /api/v1/admin/inventory/:identifier
// @access  Private/Admin
exports.getUserInventoryAndCatalog = asyncHandler(async (req, res, next) => {
    const { identifier } = req.params;

    // Find user by ID or Email
    let user;
    if (identifier.match(/^[0-9a-fA-F]{24}$/)) {
        user = await User.findById(identifier);
    }
    if (!user) {
        user = await User.findOne({ email: identifier.toLowerCase() });
    }

    if (!user) {
        return next(new ErrorResponse(`User not found with identifier of ${identifier}`, 404));
    }

    // Get user inventory
    const inventory = await StickerInventory.find({ userId: user._id }).populate('stickerId');

    // Get full catalog
    const packs = await StickerPack.find().populate('stickers');
    const stickers = await StickerDefinition.find();

    res.status(200).json({
        success: true,
        data: {
            user: {
                _id: user._id,
                name: user.name,
                email: user.email
            },
            inventory,
            catalog: {
                packs,
                stickers
            }
        }
    });
});

// @desc    Add sticker to user inventory
// @route   POST /api/v1/admin/inventory/add-sticker
// @access  Private/Admin
exports.addStickerToInventory = asyncHandler(async (req, res, next) => {
    const { userId, stickerId, quantity = 1 } = req.body;

    let inventoryEntry = await StickerInventory.findOne({ userId, stickerId });

    if (inventoryEntry) {
        inventoryEntry.quantity += quantity;
        inventoryEntry.updatedAt = Date.now();
        await inventoryEntry.save();
    } else {
        inventoryEntry = await StickerInventory.create({
            userId,
            stickerId,
            quantity
        });
    }

    res.status(200).json({
        success: true,
        data: inventoryEntry
    });
});

// @desc    Remove sticker from user inventory
// @route   POST /api/v1/admin/inventory/remove-sticker
// @access  Private/Admin
exports.removeStickerFromInventory = asyncHandler(async (req, res, next) => {
    const { userId, stickerId, quantity = 1 } = req.body;

    const inventoryEntry = await StickerInventory.findOne({ userId, stickerId });

    if (!inventoryEntry) {
        return next(new ErrorResponse(`Sticker not found in user inventory`, 404));
    }

    inventoryEntry.quantity -= quantity;
    if (inventoryEntry.quantity <= 0) {
        await inventoryEntry.deleteOne();
    } else {
        inventoryEntry.updatedAt = Date.now();
        await inventoryEntry.save();
    }

    res.status(200).json({
        success: true,
        data: {}
    });
});

// @desc    Add entire pack to user inventory
// @route   POST /api/v1/admin/inventory/add-pack
// @access  Private/Admin
exports.addPackToInventory = asyncHandler(async (req, res, next) => {
    const { userId, packId } = req.body;

    const pack = await StickerPack.findById(packId);
    if (!pack) {
        return next(new ErrorResponse(`Sticker pack not found`, 404));
    }

    const operations = pack.stickers.map(stickerId => ({
        updateOne: {
            filter: { userId, stickerId },
            update: { 
                $inc: { quantity: 1 },
                $set: { updatedAt: Date.now() },
                $setOnInsert: { createdAt: Date.now() }
            },
            upsert: true
        }
    }));

    await StickerInventory.bulkWrite(operations);

    res.status(200).json({
        success: true,
        data: {}
    });
});

// @desc    Remove entire pack from user inventory
// @route   POST /api/v1/admin/inventory/remove-pack
// @access  Private/Admin
exports.removePackFromInventory = asyncHandler(async (req, res, next) => {
    const { userId, packId } = req.body;

    const pack = await StickerPack.findById(packId);
    if (!pack) {
        return next(new ErrorResponse(`Sticker pack not found`, 404));
    }

    const operations = pack.stickers.map(stickerId => ({
        updateOne: {
            filter: { userId, stickerId, quantity: { $gt: 0 } },
            update: { 
                $inc: { quantity: -1 },
                $set: { updatedAt: Date.now() }
            }
        }
    }));

    await StickerInventory.bulkWrite(operations);

    // Clean up zero quantities
    await StickerInventory.deleteMany({ userId, quantity: { $lte: 0 } });

    res.status(200).json({
        success: true,
        data: {}
    });
});
