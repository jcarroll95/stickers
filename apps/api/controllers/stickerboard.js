// Stickerboard controllers
const path = require('path');
const ErrorResponse = require('../utils/errorResponse');
const Stickerboard = require('../models/Stickerboard');
const asyncHandler = require('../middleware/async');
const { v4: uuidv4 } = require('uuid');
const OperationLog = require('../models/OperationLog');
const { consumeSticker, hasSticker } = require('../services/stickerInventory');

/**
 * @desc Get all stickerboards
 * @route GET /api/v1/stickerboards
 * @access Public
*/
exports.getStickerboards = asyncHandler(async (req, res, next) => {
    //Legacy pagination which has been moved to advancedResults and called by routing:

    // Publish the response
    res
        .status(200)
        .json(res.advancedResults);
});

/**
 * @desc Get single stickerboard
 * @route GET /api/v1/stickerboards/:id
 * @access Public
*/
exports.getStickerboard = asyncHandler(async (req, res, next) => {
        const stickerboard = await Stickerboard.findById(req.params.id)
            .populate({ path: 'stix', options: { sort: { stickNumber: 1 } } })
            .populate('comments');

        if(!stickerboard) {
            return next(
                new ErrorResponse(`Stickerboard not found with id of ${req.params.id}`, 404)
            );
        }
        res.status(200).json({ success: true, data: stickerboard });
});

/**
 * @desc      Create new stickerboard
 * @route     POST /api/v1/stickerboards
 * @access    Private
*/
exports.createStickerboard = asyncHandler(async (req, res, next) => {
    // Add user to req.body
    req.body.user = req.user.id;

    // Check if this user already has a published stickerboard
    const publishedStickerboard = await Stickerboard.findOne({ user: req.user.id });

    // if user is not a vip they can only have one published stickerboard
    if (publishedStickerboard && req.user.role !== 'vipuser') {
        return next(new ErrorResponse(`The user with ID ${req.user.id} has already published a Stickerboard`, 400));
    }

    const stickerboard = await Stickerboard.create(req.body);
    res.status(201).json({
        success: true,
        data: stickerboard
    });

});


/**
 * @desc Helper: handles sticker placement with idempotency
 *
 * @param { req.body.opId } opId - the UUIDv4 from the web
 * @access
 */
const placeStickerWithIdempotency = async (req, res, next) => {
    const opId = req.body.opId || uuidv4();

    try {
        // Check if this operation has already been processed
        const existingOp = await OperationLog.findOne({ opId });

        if (existingOp && existingOp.status === 'completed') {
            // Return the result from the completed operation
            return res.status(200).json({
                success: true,
                message: 'Operation already completed',
                data: existingOp.result
            });
        }

        // Create operation log entry
        const operationLog = await OperationLog.create({
            opId,
            userId: req.user.id,
            operationType: 'placeSticker',
            status: 'pending',
            payload: req.body
        });

        // Process the actual sticker placement
        const result = await placeSticker(req, res, next);

        // Update operation log to completed
        await OperationLog.findByIdAndUpdate(operationLog._id, {
            status: 'completed',
            result: result.data,
            completedAt: Date.now()
        });

        return res.status(200).json({
            success: true,
            data: result.data
        });

    } catch (error) {
        // Update operation log to failed
        await OperationLog.findOneAndUpdate(
            { opId },
            {
                status: 'failed',
                result: { error: error.message },
                completedAt: Date.now()
            }
        );
        return next(error);
    }
};

/**
 * Helper: constructs a validated cheers sticker object
 * @param {Object} input - Raw sticker seed-data from web
 * @returns {Object|null} - Validated sticker or null if invalid
 */
function buildCheersSticker(input) {
    if (!input || typeof input !== 'object') return null;
    
    // stickerId can be Number (legacy) or ObjectId string (new inventory)
    let stickerId = input.stickerId;
    if (typeof stickerId === 'string' && !stickerId.match(/^[0-9a-fA-F]{24}$/)) {
        stickerId = Number(stickerId);
    }
    
    const x = Number(input.x);
    const y = Number(input.y);

    // basic validation
    const isValidId = (typeof stickerId === 'number' && Number.isFinite(stickerId)) || 
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
        createdAt: new Date()
    };
}

/**
 * @desc Update stickerboard
 * @route PUT /api/v1/stickerboards/:id
 * @access Private
*/
exports.updateStickerboard = asyncHandler(async (req, res, next) => {
    const mongoose = require('mongoose');
    const User = require('../models/User');
    const { opId } = req.body;

    // If opId is provided, it's handled by idempotency middleware
    // This controller just needs to execute the business logic

    // Start session
    const session = await mongoose.startSession();
    let useTransaction = true;

    try {
        await session.startTransaction();
        // Force a dummy operation to verify transaction support
        if (useTransaction) {
            await Stickerboard.findOne({ _id: new mongoose.Types.ObjectId() }).session(session);
        }
    } catch (err) {
        // Fallback for environments without replica sets (e.g. local dev)
        // Error 20: Transaction numbers are only allowed on a replica set member
        if (err.code === 20 || err.message.includes('replica set') || err.message.includes('Transaction numbers')) {
            useTransaction = false;
            if (session.inTransaction()) {
                await session.abortTransaction();
            }
        } else {
            session.endSession();
            return next(err);
        }
    }

    try {
        const sessionOpt = useTransaction ? { session } : {};
        let stickerboard = await Stickerboard.findById(req.params.id).session(useTransaction ? session : null);

        if (!stickerboard) {
            if (useTransaction) await session.abortTransaction();
            session.endSession();
            return next(new ErrorResponse(`Stickerboard not found with id of ${req.params.id}`, 404));
        }

        // Check ownership
        const isOwner = stickerboard.user.toString() === req.user.id;
        const isAdmin = req.user.role === 'admin';

        let candidateSticker;

        if (!isOwner && !isAdmin) {
            // Non-owner updates: must ONLY be adding a sticker
            const updates = Object.keys(req.body);
            const isOnlyStickers = updates.length === 1 && (updates[0] === 'stickers' || updates[0] === 'sticker');

            if (!isOnlyStickers) {
                if (useTransaction) await session.abortTransaction();
                session.endSession();
                return next(new ErrorResponse(`User ${req.user.id} is not authorized to update this board`, 401));
            }

            // Extract candidate sticker
            if (Array.isArray(req.body.stickers)) {
                if (req.body.stickers.length <= stickerboard.stickers.length) {
                    if (useTransaction) await session.abortTransaction();
                    session.endSession();
                    return next(new ErrorResponse(`Invalid stickers update: must append a sticker`, 400));
                }
                candidateSticker = req.body.stickers[req.body.stickers.length - 1];
            } else if (req.body.sticker && typeof req.body.sticker === 'object') {
                candidateSticker = req.body.sticker;
            } else {
                if (useTransaction) await session.abortTransaction();
                session.endSession();
                return next(new ErrorResponse(`Invalid stickers update: missing sticker data`, 400));
            }

            // Whitelist and build sticker
            const stickerToInsert = buildCheersSticker(candidateSticker);
            if (!stickerToInsert) {
                if (useTransaction) await session.abortTransaction();
                session.endSession();
                return next(new ErrorResponse(`Invalid sticker data provided`, 400));
            }

            // 1. Consume sticker first (atomic conditional update)
            // Handle both legacy (Number) and new (ObjectId) stickers
            const user = await User.findById(req.user.id).session(useTransaction ? session : null);
            
            let stickerIdx = -1;
            if (typeof stickerToInsert.stickerId === 'number') {
                stickerIdx = user.cheersStickers.indexOf(stickerToInsert.stickerId);
            } else {
                // For ObjectId, we need to check the new inventory system
                // However, non-owner updates currently assume Cheers! stickers
                // If we want to support inventory stickers for Cheers!, we should check StickerInventory
                const StickerInventory = require('../models/StickerInventory');
                const inventoryEntry = await StickerInventory.findOne({ 
                    userId: req.user.id, 
                    stickerId: stickerToInsert.stickerId 
                }).session(useTransaction ? session : null);

                if (inventoryEntry && inventoryEntry.quantity > 0) {
                    inventoryEntry.quantity -= 1;
                    inventoryEntry.updatedAt = new Date();
                    await inventoryEntry.save(sessionOpt);
                    stickerIdx = 999; // bypass legacy check
                }
            }

            if (stickerIdx === -1) {
                if (useTransaction) await session.abortTransaction();
                session.endSession();
                return next(new ErrorResponse(`User does not have the required sticker`, 400));
            }

            if (stickerIdx !== 999) {
                user.cheersStickers.splice(stickerIdx, 1);
                await user.save(sessionOpt);
            }

            // 2. Append to board
            stickerboard = await Stickerboard.findOneAndUpdate(
                { _id: req.params.id },
                { $push: { stickers: stickerToInsert } },
                { new: true, runValidators: true, ...sessionOpt }
            );
        } else {
            // Owners/Admins update
            // Field allowlist for board metadata
            const allowedBoardFields = ['name', 'description', 'tags', 'photo', 'stickers'];
            const updateData = {};
            allowedBoardFields.forEach(field => {
                if (req.body[field] !== undefined) updateData[field] = req.body[field];
            });

            // If updating stickers as owner, check if we need to consume from inventory
            if (updateData.stickers && Array.isArray(updateData.stickers) && stickerboard.stickers) {
                const isAppending = updateData.stickers.length === stickerboard.stickers.length + 1;
                if (isAppending) {
                    const newSticker = updateData.stickers[updateData.stickers.length - 1];
                    // Check if it's an inventory sticker (ObjectId)
                    if (typeof newSticker.stickerId === 'string' && newSticker.stickerId.match(/^[0-9a-fA-F]{24}$/)) {
                        const StickerInventory = require('../models/StickerInventory');
                        const inventoryEntry = await StickerInventory.findOne({ 
                            userId: req.user.id, 
                            stickerId: newSticker.stickerId 
                        }).session(useTransaction ? session : null);

                        if (inventoryEntry && inventoryEntry.quantity > 0) {
                            inventoryEntry.quantity -= 1;
                            inventoryEntry.updatedAt = new Date();
                            await inventoryEntry.save(sessionOpt);
                        } else if (!isAdmin) {
                            // Only admins can place stickers they don't have
                            if (useTransaction) await session.abortTransaction();
                            session.endSession();
                            return next(new ErrorResponse(`User does not have the required sticker in inventory`, 400));
                        }
                    }
                }
            }

            stickerboard = await Stickerboard.findOneAndUpdate(
                { _id: req.params.id },
                updateData,
                { new: true, runValidators: true, ...sessionOpt }
            );
        }

        if (useTransaction) await session.commitTransaction();
        session.endSession();

        const response = { success: true, data: stickerboard };

        // Include opId in response if provided
        if (opId) {
            response.opId = opId;
        }

        res.status(200).json(response);
    } catch (err) {
        if (useTransaction) await session.abortTransaction();
        session.endSession();
        next(err);
    }
});

/**
 * @desc Delete stickerboard
 * @route DELETE /api/v1/stickerboards/:id
 * @acess Private
*/
exports.deleteStickerboard = asyncHandler(async (req, res, next) => {
        const stickerboard = await Stickerboard.findById(req.params.id);

        if (!stickerboard) {
            return next(
                new ErrorResponse(`Stickerboard not found with id of ${req.params.id}`, 404)
            );
        }
        //await Stick.deleteMany({ belongsToBoard: req.params.id });

        // make sure this user owns the stickerboard
        if (stickerboard.user.toString() !== req.user.id && req.user.role !== 'admin') {
            return next(
                new ErrorResponse(`User ${req.user.id} is not authorized to delete this board`, 401)
            )
        }

        await stickerboard.deleteOne();

        // if the delete is successful we'll return an empty object {}
        res.status(200).json({ success: true, data: {} });
});

/**
 * @desc Upload photo for stickerboard
 * @route PUT /api/v1/stickerboards/:id/photo
 * @acess Private
*/
exports.stickerboardPhotoUpload= asyncHandler(async (req, res, next) => {
    const stickerboard = await Stickerboard.findById(req.params.id);

    if (!stickerboard) {
        return next(
            new ErrorResponse(`Stickerboard not found with id of ${req.params.id}`, 404)
        );
    }

    // make sure this user owns the stickerboard
    if (stickerboard.user.toString() !== req.user.id && req.user.role !== 'admin') {
        return next(
            new ErrorResponse(`User ${req.user.id} is not authorized to delete this board`, 401)
        )
    }

    if (!req.files) {
        return next(
            new ErrorResponse(`Please upload a file`, 400)
        );
    }

    const file = req.files.file;
    console.log(file);
    // check that we got a photo
    if (!file.mimetype.startsWith('image')) {
        return next(new ErrorResponse(`Please upload an image`, 400));
    }

    // check filesize
    if (file.size > process.env.MAX_FILE_UPLOAD) {
        return next(
            new ErrorResponse(`Please upload an image smaller than ${process.env.MAX_FILE_UPLOAD} bytes`, 400)
        );
    }

    // create filename
    file.name = `photo_${stickerboard._id}${path.parse(file.name).ext}`;
    console.log(file.name);

    // write the file
    file.mv(`${process.env.FILE_UPLOAD_PATH}/${file.name}`, async err => {

        if (err) {
            console.error(err);
            return next(
                new ErrorResponse(`Problem with file upload`, 500)
            );
        }

        await Stickerboard.findByIdAndUpdate(req.params.id, { photo: file.name });
        res.status(200).json({
            success: true,
            data: file.name
        });
    });

});

/**
 * @desc System-generated thumbnail update for stickerboard
 * @route POST /api/v1/stickerboards/:id/thumbnail
 * @access Private
 */
exports.postThumbnail = asyncHandler(async (req, res, next) => {
    const { isRateLimited, updateRateLimit, getTimeRemaining } = require('../utils/rateLimiter');

    const stickerboard = await Stickerboard.findById(req.params.id);

    if (!stickerboard) {
        return next(
            new ErrorResponse(`Stickerboard not found with id of ${req.params.id}`, 404)
        );
    }

    // Check rate limit (per user per board) - skip for admins or if it's an explicit manual request
    const isAdmin = req.user.role === 'admin';
    const isManual = req.body.isManual === true;
    if (!isAdmin && !isManual && isRateLimited(req.user.id, req.params.id)) {
        const remaining = Math.ceil(getTimeRemaining(req.user.id, req.params.id) / 1000);
        return next(
            new ErrorResponse(`Rate limit exceeded. Please wait ${remaining} seconds before uploading another thumbnail for this board.`, 429)
        );
    }

    // Expect base64 encoded image seed-data in request body
    if (!req.body.imageData) {
        return next(new ErrorResponse('Image seed-data is required', 400));
    }

    // Allow owner, admin, or any authenticated user (for cheers stickers)
    // Authentication is handled by the protect middleware

    try {
        // Convert base64 to buffer
        const base64Data = req.body.imageData.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');

        // Dynamically import the ES module helper
        const { uploadThumbnailToS3, cleanupOldThumbnails } = await import('../utils/s3Helper.js');

        // Upload to S3
        const result = await uploadThumbnailToS3(stickerboard.id, buffer);

        // Update database with thumbnail metadata
        const { publicUrl, key, version, contentType, bytes } = result;
        const width = req.body.width || 0;
        const height = req.body.height || 0;

        await Stickerboard.findByIdAndUpdate(req.params.id, {
            thumbnail: {
                version,
                width,
                height,
                contentType,
                bytes,
                url: publicUrl,
            }
        });

        // Update rate limit after successful upload
        updateRateLimit(req.user.id, req.params.id);

        // Trigger cleanup of old thumbnails (async, don't wait for it)
        cleanupOldThumbnails(stickerboard.id, 3).catch(err => {
            console.error('Failed to cleanup old thumbnails:', err);
        });

        res.status(200).json({
            success: true,
            data: {
                publicUrl,
                version,
                width,
                height,
            }
        });
    } catch (err) {
        console.error('Error in postThumbnail:', err);
        console.error('Error details:', {
            name: err.name,
            message: err.message,
            code: err.code,
            statusCode: err.$metadata?.httpStatusCode,
            requestId: err.$metadata?.requestId,
        });
        return next(new ErrorResponse(`Failed to upload thumbnail: ${err.name} - ${err.message}`, 500));
    }
});