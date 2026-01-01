// Controller for each stick entry
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const Stick = require('../models/Stick');
const Stickerboard = require('../models/Stickerboard');

// @desc    Get stix
// @route   GET /api/v1/stix
// @route   GET /api/v1/stickerboards/:belongsToBoard/stix
// @access  Private
exports.getStix = asyncHandler(async (req, res, next) => {

    if (req.params.belongsToBoard) {
        // This setup will not apply advancedResults if you're pulling stix from only one board
        const stix = await Stick.find({ belongsToBoard: req.params.belongsToBoard } );
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

// @desc    Get stick
// @route   GET /api/v1/stix/:stickId
// @access  Private
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

// @desc    Add a stick
// @route   POST /api/v1/stix/:belongsToBoard
// @access  Private
exports.addStick = asyncHandler(async (req, res, next) => {
    // we need the stickerboard _id that's in the URL to become something we can submit in the body of our
    // response which is adding a new stick IAW our stick model, so let's manually grab it:
    req.body.belongsToBoard = req.params.belongsToBoard;

    req.body.user = req.user.id;

    // all sticks are associated with a stickerboard. adding a stick must be done by the owner of that board.

    // get the stickerboard by ID
    const stickerboard = await Stickerboard.findById(req.params.belongsToBoard);
    // if it doesn't exist, throw an error
    if (!stickerboard) {
        return next(new ErrorResponse(`No stickerboard found with id ${req.params.belongsToBoard}`, 404));
    }

    // make sure this user owns the stickerboard
    if (stickerboard.user.toString() !== req.user.id && req.user.role !== 'admin') {
        return next(
            new ErrorResponse(`User ${req.user.id} is not authorized to add stix to board ${stickerboard.id}`, 401)
        )
    }

    // mongoose .create IAW our stick model, creating a document that contains the data in our req.body
    const stick = await Stick.create(req.body);

    // Also add a new sticker entry to the stickerboard's stickers[] palette
    try {
        // Ensure stickers array exists
        if (!Array.isArray(stickerboard.stickers)) {
            stickerboard.stickers = [];
        }

        // Determine preferred stickerId between 0-9 based on the stick number
        // (Modulo 10 to rotate through the 10 available sticker assets)
        let chosenId = 0;
        if (typeof stick.stickNumber === 'number') {
            chosenId = stick.stickNumber % 10;
        } else {
            // Fallback to finding first unused if stickNumber is missing
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
            stuck: false, // ensure initial state is not placed yet
            createdAt: now
        };

        stickerboard.stickers.push(newSticker);
        await stickerboard.save();
    } catch (e) {
        // If updating the palette fails, do not fail stick creation; log error and continue
        // eslint-disable-next-line no-console
        console.error('Failed to update stickerboard palette after stick creation:', e);
    }

    res.status(200).json({
        success: true,
        data: stick
    })
});


// @desc    Update a stick
// @route   PUT /api/v1/stix/:stickId
// @access  Private
exports.updateStick = asyncHandler(async (req, res, next) => {
    // get the stickerboard by ID and replace the data with json passed in the req body
    // new: true will return the newly updated mongo data in stick
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

    stick = await Stick.findByIdAndUpdate(req.params.stickId, req.body, {
        new: true,
        runValidators: true
    });

    res.status(200).json({
        success: true,
        data: stick
    })
});

// @desc    Delete a stick
// @route   DELETE /api/v1/stix/:stickId
// @access  Private
exports.deleteStick = asyncHandler(async (req, res, next) => {
    let stick = await Stick.findById(req.params.stickId);
    // if it doesn't exist, throw an error
    if (!stick) {
        return next(new ErrorResponse(`No stick found with id ${req.params.stickId}`, 404));
    }

    await stick.deleteOne();
    res.status(200).json({ success: true, data: {} });
});