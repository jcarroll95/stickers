// Controller for each stick entry
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const Stick = require('../models/Stick');
const Stickerboard = require('../models/Stickerboard');

/**
 * @desc    Get stix
 * @route   GET /api/v1/stix
 * @route   GET /api/v1/stickerboards/:belongsToBoard/stix
 * @access  Private
*/
exports.getStix = asyncHandler(async (req, res, next) => {

    if (req.params.belongsToBoard) {
        // This setup will not apply advancedResults if you're pulling stix from only one board
        const stix = await Stick.find({ belongsToBoard: req.params.belongsToBoard }).sort({ stickNumber: 1 });
        return res.status(200).json( { success: true, count: stix.length, data: stix });
    } else {
        // if you request ALL stix it will paginate via advancedResults
        return res.status(200).json(res.advancedResults);

    }

    // put the results of the mongoose .find() into stix
    const stix = await query;

    // This was modified to test these conditions since !stix would always return an empty array
    // if no matching records were found, and [] is truthy.
    if (req.params.belongsToBoard && Array.isArray(stix) && stix.length === 0) {
        return next(
            new ErrorResponse(`Stickerboard not found with id of ${req.params.belongsToBoard}`, 404)
        );
    }

    res.status(200).json({
        success: true,
        count: stix.length,
        data: stix
    })

});

/**
 * @desc    Get stick
 * @route   GET /api/v1/stix/:stickId
 * @access  Private
*/
exports.getStick = asyncHandler(async (req, res, next) => {
    const stick = await Stick.findById(req.params.stickId).populate( {
        path: 'belongsToBoard',
        select: [ 'name', 'description' ]
    } );

    if (!stick) {
        return next(new ErrorResponse(`No stick found with id ${req.params.stickId}`, 404));
    }

    res.status(200).json({
        success: true,
        data: stick
    })
});

/**
 * @desc    Add a stick
 * @route   POST /api/v1/stix/:belongsToBoard
 * @access  Private
*/
exports.addStick = asyncHandler(async (req, res, next) => {
    const mongoose = require('mongoose');

    // Field allowlist for Stick
    const allowedFields = [
        'stickNumber', 'stickMed', 'stickLocation', 'stickLocMod', 
        'stickDose', 'userTime', 'userDate', 'description', 
        'nsv', 'weight', 'cost'
    ];
    const stickData = {
        belongsToBoard: req.params.belongsToBoard,
        user: req.user.id
    };
    allowedFields.forEach(field => {
        if (req.body[field] !== undefined && req.body[field] !== '') {
            stickData[field] = req.body[field];
        }
    });

    // Start session for atomic update
    const session = await mongoose.startSession();
    let useTransaction = true;

    try {
        await session.startTransaction();
        // Force a dummy operation to verify transaction support
        if (useTransaction) {
            await Stickerboard.findOne({ _id: new mongoose.Types.ObjectId() }).session(session);
        }
    } catch (err) {
        // Fallback for non-replica set environments
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

        // 1. Check if stickerboard exists and user owns it
        const stickerboard = await Stickerboard.findById(req.params.belongsToBoard).session(useTransaction ? session : null);
        if (!stickerboard) {
            if (useTransaction) await session.abortTransaction();
            session.endSession();
            return next(new ErrorResponse(`No stickerboard found with id ${req.params.belongsToBoard}`, 404));
        }

        if (stickerboard.user.toString() !== req.user.id && req.user.role !== 'admin') {
            if (useTransaction) await session.abortTransaction();
            session.endSession();
            return next(new ErrorResponse(`User ${req.user.id} is not authorized to add stix to board ${stickerboard.id}`, 401));
        }

        // 2. Create the stick
        const stick = await Stick.create([stickData], sessionOpt);
        const newStick = stick[0]; // create with session returns an array

        // 3. Update the stickerboard palette
        if (!Array.isArray(stickerboard.stickers)) {
            stickerboard.stickers = [];
        }

        let chosenId = 0;
        if (typeof newStick.stickNumber === 'number') {
            chosenId = newStick.stickNumber % 10;
        } else {
            const used = new Set(
                stickerboard.stickers
                    .map((s) => (typeof s?.stickerId === 'number' ? s.stickerId : null))
                    .filter((n) => n != null)
            );
            for (let i = 0; i <= 9; i++) {
                if (!used.has(i)) {
                    chosenId = i;
                    break;
                }
                if (i === 9) chosenId = 0;
            }
        }

        const now = new Date();
        const newSticker = {
            stickerId: chosenId,
            x: 0,
            y: 0,
            scale: 1,
            rotation: 0,
            zIndex: 0,
            stuck: false,
            createdAt: now
        };

        await Stickerboard.findByIdAndUpdate(
            req.params.belongsToBoard,
            { $push: { stickers: newSticker } },
            { ...sessionOpt, new: true, runValidators: true }
        );

        if (useTransaction) await session.commitTransaction();
        session.endSession();

        res.status(200).json({
            success: true,
            data: newStick
        });
    } catch (err) {
        if (useTransaction) await session.abortTransaction();
        session.endSession();
        next(err);
    }
});

/**
 * @desc    Update a stick
 * @route   PUT /api/v1/stix/:stickId
 * @access  Private
*/
exports.updateStick = asyncHandler(async (req, res, next) => {
    // get the stick by ID
    let stick = await Stick.findById(req.params.stickId);
    // if it doesn't exist, throw an error
    if (!stick) {
        return next(new ErrorResponse(`No stick found with id ${req.params.stickId}`, 404));
    }

    // make sure this user owns the stick
    if (stick.user.toString() !== req.user.id && req.user.role !== 'admin') {
        return next(
            new ErrorResponse(`User ${req.user.id} is not authorized to update this stick`, 401)
        )
    }

    // Field allowlist for Stick updates
    const allowedFields = [
        'stickNumber', 'stickMed', 'stickLocation', 'stickLocMod', 
        'stickDose', 'userTime', 'userDate', 'description', 
        'nsv', 'weight', 'cost'
    ];
    const updateData = {};
    allowedFields.forEach(field => {
        if (req.body[field] !== undefined) {
            // If the field is sent as an empty string, we treat it as wanting to clear the field (null)
            // unless it's a numeric field where we might want to handle it differently.
            // But for enums, null or omitting is better than "".
            updateData[field] = req.body[field] === '' ? null : req.body[field];
        }
    });

    stick = await Stick.findByIdAndUpdate(req.params.stickId, updateData, {
        new: true,
        runValidators: true
    });

    res.status(200).json({
        success: true,
        data: stick
    })
});

/**
 * @desc    Delete a stick
 * @route   DELETE /api/v1/stix/:stickId
 * @access  Private
*/
exports.deleteStick = asyncHandler(async (req, res, next) => {
    let stick = await Stick.findById(req.params.stickId);
    // if it doesn't exist, throw an error
    if (!stick) {
        return next(new ErrorResponse(`No stick found with id ${req.params.stickId}`, 404));
    }

    await stick.deleteOne();
    res.status(200).json({ success: true, data: {} });
});