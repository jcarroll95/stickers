const StickerInventory = require('../models/StickerInventory');
const StickerDefinition = require('../models/StickerDefinition');
const mongoose = require('mongoose');

const createStickerTransaction = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { userId, stickerId, opId } = req.body;

        // Check if transaction already exists (idempotency)
        const existingTransaction = await StickerInventory.findOne({
            userId,
            stickerId,
            opId
        });

        if (existingTransaction) {
            // Transaction already completed, return existing result
            return res.json({
                success: true,
                message: 'Transaction already completed',
                data: existingTransaction
            });
        }

        // Check if user already has this sticker
        const existingSticker = await StickerInventory.findOne({
            userId,
            stickerId
        });

        if (existingSticker) {
            // Increment quantity
            existingSticker.quantity += 1;
            existingSticker.opId = opId; // Update opId for idempotency check if retried
            // Ensure packId is set for existing entries that might be missing it
            if (!existingSticker.packId) {
                const stickerDef = await StickerDefinition.findById(stickerId);
                if (stickerDef && stickerDef.packId) {
                    existingSticker.packId = stickerDef.packId;
                }
            }
            existingSticker.updatedAt = new Date();
            await existingSticker.save({ session });
            
            await session.commitTransaction();
            return res.json({
                success: true,
                message: 'Sticker quantity incremented',
                data: existingSticker
            });
        }

        // Fetch sticker definition to get packId
        const stickerDef = await StickerDefinition.findById(stickerId);

        // Create new sticker entry
        const newStickerEntry = new StickerInventory({
            userId,
            stickerId,
            packId: stickerDef ? stickerDef.packId : null,
            opId,
            quantity: 1,
            timestamp: new Date()
        });

        await newStickerEntry.save({ session });

        await session.commitTransaction();

        res.json({
            success: true,
            message: 'Sticker awarded successfully',
            data: newStickerEntry
        });
    } catch (error) {
        await session.abortTransaction();
        next(error);
    } finally {
        session.endSession();
    }
};

const revokeStickerTransaction = async (req, res, next) => {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
        const { userId, stickerId, opId } = req.body;

        // Check if transaction already exists (idempotency)
        const existingTransaction = await StickerInventory.findOne({
            userId,
            stickerId,
            opId
        });

        if (existingTransaction) {
            // Transaction already completed, return existing result
            return res.json({
                success: true,
                message: 'Transaction already completed',
                data: existingTransaction
            });
        }

        // Find and decrement the sticker entry quantity
        const stickerEntry = await StickerInventory.findOne({
            userId,
            stickerId
        });

        if (!stickerEntry || stickerEntry.quantity <= 0) {
            return res.status(404).json({
                success: false,
                message: 'Sticker not available in user inventory'
            });
        }

        stickerEntry.quantity -= 1;
        stickerEntry.opId = opId;
        stickerEntry.updatedAt = new Date();
        await stickerEntry.save({ session });

        await session.commitTransaction();

        res.json({
            success: true,
            message: 'Sticker consumed successfully',
            data: stickerEntry
        });
    } catch (error) {
        await session.abortTransaction();
        next(error);
    } finally {
        session.endSession();
    }
};

module.exports = {
    createStickerTransaction,
    revokeStickerTransaction
};