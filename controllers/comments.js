// Controller for each comment
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const Comment = require('../models/Comment');
const Stickerboard = require('../models/Stickerboard');
const User = require('../models/User');

/**
 * @desc    Get comments
 * @route   GET /api/v1/comments
 * @route   GET /api/v1/stickerboards/:belongsToBoard/comments
 * @access  Public
*/
exports.getComments = asyncHandler(async (req, res, next) => {
    if (req.params.belongsToBoard) {
        const comments = await Comment.find({ belongsToBoard: req.params.belongsToBoard } );
        //return res.status(200).json( { success: true, count: comments.length, data: comments });
        // we need to update the response below to include pagination
        return res.status(200).json({
            success: true,
            count: comments.length,
            data: comments
        });
    } else {
        // if you request ALL comments it will paginate via advancedResults
        return res.status(200).json(res.advancedResults);
    }
});

/**
 * @desc    Get a single comment
 * @route   GET /api/v1/comments/:id
 * @access  Public
*/
 exports.getComment = asyncHandler(async (req, res, next) => {
    const comment = await Comment.findById(req.params.id).populate({
        path: 'belongsToBoard',
        select: 'name description'
    });

    if (!comment) {
        return next(new ErrorResponse(`No comment found with id ${req.params.id}`, 404));
    }

    res.status(200).json({
        success: true,
        data: comment
    });
});

/**
 * @desc    Add a comment
 * @route   POST /api/v1/stickerboards/:belongsToBoard/comments
 * @access  Private
*/
 exports.addComment = asyncHandler(async (req, res, next) => {
    const stickerboard = await Stickerboard.findById(req.params.belongsToBoard);

    if (!stickerboard) {
        return next(new ErrorResponse(`No stickerboard with id ${req.params.belongsToBoard}`, 404));
    }

    // Field allowlist
    const commentData = {
        belongsToBoard: req.params.belongsToBoard,
        belongsToUser: req.user.id,
        commentRating: req.body.commentRating,
        comment: req.body.comment
    };

    const comment = await Comment.create(commentData);

    res.status(201).json({
        success: true,
        data: comment
    })
});

/**
 * @desc    Update a comment
 * @route   PUT /api/v1/comments/:id
 * @access  Private
*/
exports.updateComment = asyncHandler(async (req, res, next) => {

    let comment = await Comment.findById(req.params.id);

    if (!comment) {
        return next(new ErrorResponse(`No comment with id ${req.params.id}`, 404));
    }

    // check permissions to update this comment
    if (comment.belongsToUser.toString() !== req.user.id && req.user.role !== 'admin') {
        return next(new ErrorResponse(`Not authorized to update comment ${req.params.id}`, 401));
    }

    // Field allowlist
    const updateData = {
        commentRating: req.body.commentRating,
        comment: req.body.comment
    };

    comment = await Comment.findByIdAndUpdate(req.params.id, updateData, {
        new: true,
        runValidators: true
    });

    res.status(200).json({
        success: true,
        data: comment
    });
});

/**
 * @desc    Delete a comment
 * @route   DELETE /api/v1/comments/:id
 * @access  Private
*/
exports.deleteComment = asyncHandler(async (req, res, next) => {

    const comment = await Comment.findById(req.params.id);

    if (!comment) {
        return next(new ErrorResponse(`No comment with id ${req.params.id}`, 404));
    }

    // check permissions to update this comment
    if (comment.belongsToUser.toString() !== req.user.id && req.user.role !== 'admin') {
        return next(new ErrorResponse(`Not authorized to update comment ${req.params.id}`, 401));
    }

    await comment.deleteOne();

    res.status(200).json({
        success: true,
        data: {}
    });
});