// Stickerboard controllers
const path = require('path');
const ErrorResponse = require('../utils/errorResponse');
const Stickerboard = require('../models/Stickerboard');
const asyncHandler = require('../middleware/async');

/**
 * @desc Get all stickerboards
 * @route GET /api/v1/stickerboards
 * @access Public
*/
exports.getStickerboards = asyncHandler(async (req, res, next) => {
    let query;  // just initialize

    // Spread operator fun
    const reqQuery = { ...req.query };

    // Array of Fields to exclude when filtering
    // select chooses to return a limited selection of fields from the query
    // sort chooses sortby field and establishes a default
    // page and limit are for pagination. limit = results per page
    const removeFields = ['select', 'sort', 'page', 'limit'];

    // Loop over removeFields and delete them from reqQuery so we aren't searching the DB for 'select'
    removeFields.forEach(param => delete reqQuery[param]);

    // Create query string against the SANITIZED version of reqQuery so we don't re-insert the removed fields
    let queryStr = JSON.stringify(reqQuery);

    // regex goes between //s, \b word boundary, /g global
    // Create comparison operators we can pass to mongoose
    queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in|ne)\b/g, match => `$${match}`);

    // Find the resource now that queryStr has been massaged to work for the mongoose method
    query = Stickerboard.find(JSON.parse(queryStr)).populate('stix').populate('comments');

    // Sort the query with default by created date descending
    if (req.query.sort) {
        const sortBy = req.query.sort.split(',').join(' ');
        query = query.sort(sortBy);
    } else {
        query = query.sort('-createdAt');   // -1 is mongoose for descending
    }

    // Select fields if select was included in the query
    if (req.query.select) {
        // Selected fields are comma delimited in our request, but Mongoose wants them space delimited
        // .split turns them into an array, join rejoins them space delimited
        const fields = req.query.select.split(',').join(' ');
        query = query.select(fields);
    }

    // Pagination stuff
    const page = parseInt(req.query.page, 10) || 1;       // requested page, default 1
    const limit = parseInt(req.query.limit, 10) || 20;    // requested perpage, default 20
    const startIndex = (page - 1) * limit;                      // which result to start listing on this page
    const endIndex = page * limit;                              // last result
    const total = await Stickerboard.countDocuments(JSON.parse(queryStr));

    // mongoose .skip() means skips this number of results before returning results
    // .limit() means restrict the number of documents returned by this query
    query = query.skip(startIndex).limit(limit);

    // Execute the query
    const stickerboards = await query;

    // Pagination result object
    const pagination = {}

    if (endIndex < total) {
        pagination.next = {
            page: page + 1,
            limit
        }
    }

    if (startIndex > 0) {
        pagination.prev = {
            page: page - 1,
            limit
        }
    }

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
    console.log(req.body);

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
 * Helper: constructs a validated cheers sticker object
 * @param {Object} input - Raw sticker data from client
 * @returns {Object|null} - Validated sticker or null if invalid
 */
function buildCheersSticker(input) {
    if (!input || typeof input !== 'object') return null;
    const stickerId = Number(input.stickerId);
    const x = Number(input.x);
    const y = Number(input.y);

    // basic numeric checks (schema will also validate)
    if (!Number.isFinite(stickerId) || !Number.isFinite(x) || !Number.isFinite(y)) return null;

    return {
        stickerId,
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
            const consumeRes = await User.updateOne(
                { _id: req.user.id, cheersStickers: stickerToInsert.stickerId },
                { $pull: { cheersStickers: stickerToInsert.stickerId } },
                sessionOpt
            );

            if (consumeRes.modifiedCount !== 1) {
                if (useTransaction) await session.abortTransaction();
                session.endSession();
                return next(new ErrorResponse(`User does not have the required Cheers! sticker`, 400));
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

            stickerboard = await Stickerboard.findOneAndUpdate(
                { _id: req.params.id },
                updateData,
                { new: true, runValidators: true, ...sessionOpt }
            );
        }

        if (useTransaction) await session.commitTransaction();
        session.endSession();

        res.status(200).json({ success: true, data: stickerboard });
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