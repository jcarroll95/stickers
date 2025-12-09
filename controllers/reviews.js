// Controller for each review
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const Review = require('../models/Review');
const Stickerboard = require('../models/Stickerboard');
const User = require('../models/User');

// @desc    Get reviews
// @route   GET /api/v1/reviews
// @route   GET /api/v1/stickerboards/:belongsToBoard/reviews
// @access  Public
exports.getReviews = asyncHandler(async (req, res, next) => {
    if (req.params.belongsToBoard) {
        const reviews = await Review.find({ belongsToBoard: req.params.belongsToBoard } );
        //return res.status(200).json( { success: true, count: reviews.length, data: reviews });
        // we need to update the response below to include pagination
        return res.status(200).json({
            success: true,
            count: reviews.length,
            data: reviews
        });
    } else {
        // if you request ALL reviews it will paginate via advancedResults
        return res.status(200).json(res.advancedResults);
    }
});

// @desc    Get a single review
// @route   GET /api/v1/reviews/:id
// @access  Public
exports.getReview = asyncHandler(async (req, res, next) => {
    const review = await Review.findById(req.params.id).populate({
        path: 'stickerboard',
        select: 'name description'
    });

    if (!review) {
        return next(new ErrorResponse(`No comment found with id ${req.params.id}`, 404));
    }

    res.status(200).json({
        success: true,
        data: review
    });
});