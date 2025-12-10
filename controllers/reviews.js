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
        path: 'belongsToBoard',
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

// @desc    Add a review
// @route   POST /api/v1/stickerboards/:belongsToBoard/reviews
// @access  Private
exports.addReview = asyncHandler(async (req, res, next) => {
    req.body.belongsToBoard = req.params.belongsToBoard;
    req.body.belongsToUser = req.user.id;

    const stickerboard = await Stickerboard.findById(req.params.belongsToBoard);

    if (!stickerboard) {
        return next(new ErrorResponse(`No stickerboard with id ${req.params.belongsToBoard}`, 404));
    }

    const review = await Review.create(req.body);

    res.status(201).json({
        success: true,
        data: review
    })
});

// @desc    Update a review
// @route   PUT /api/v1/reviews/:id
// @access  Private
exports.updateReview = asyncHandler(async (req, res, next) => {

    let review = await Review.findById(req.params.id);

    if (!review) {
        return next(new ErrorResponse(`No review with id ${req.params.id}`, 404));
    }

    // check permissions to update this review
    if (review.belongsToUser.toString() !== req.user.id && req.user.role !== 'admin') {
        return next(new ErrorResponse(`Not authorized to update review ${req.params.id}`, 401));
    }

    review = await Review.findByIdAndUpdate(req.params.id, req.body, {
        new: true,
        runValidators: true
    });

    res.status(200).json({
        success: true,
        data: review
    });
});

// @desc    Delete a review
// @route   DELETE /api/v1/reviews/:id
// @access  Private
exports.deleteReview = asyncHandler(async (req, res, next) => {

    const review = await Review.findById(req.params.id);

    if (!review) {
        return next(new ErrorResponse(`No review with id ${req.params.id}`, 404));
    }

    // check permissions to update this review
    if (review.belongsToUser.toString() !== req.user.id && req.user.role !== 'admin') {
        return next(new ErrorResponse(`Not authorized to update review ${req.params.id}`, 401));
    }

    await review.deleteOne();

    res.status(200).json({
        success: true,
        data: {}
    });
});