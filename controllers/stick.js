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
    let query;

    if (req.params.belongsToBoard) {
        // OK so Stick is our Mongoose model of a stick. We REQUIRED it above.
        // Mongoose method .find applied to model Stick with the input of an object where the
        // document field belongsToBoard is equal to the passed stickerboard Id.
        // This is a tedious way of doing it given our framework but let's try.
        query = Stick.find({ belongsToBoard: req.params.belongsToBoard } );

    } else {
        // If we're here then we didn't pass a belongsToBoard, so this will find all sticks
        // .populate will pull the name and description of the stickerboard each stick belongs to
        query = Stick.find().populate({
            path: 'belongsToBoard',
            select: [ 'name', 'description' ]
        });
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

    // all sticks are associated with a stickerboard. adding a stick must be done by the owner of that board.

    // get the stickerboard by ID
    const stickerboard = await Stickerboard.findById(req.params.belongsToBoard);
    // if it doesn't exist, throw an error
    if (!stickerboard) {
        return next(new ErrorResponse(`No stickerboard found with id ${req.params.belongsToBoard}`, 404));
    }

    // mongoose .create IAW our stick model, creating a document that contains the data in our req.body
    const stick = await Stick.create(req.body);

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

    stick = await Stick.findByIdAndUpdate(req.params.stickId, req.body, {
        new: true,
        runValidators: true
    });

    res.status(200).json({
        success: true,
        data: stick
    })
});