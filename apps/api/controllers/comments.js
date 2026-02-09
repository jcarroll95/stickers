// Controller for each comment
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');

const {
  getCommentsForBoard,
  getCommentById,
  addComment,
  updateComment,
  deleteComment,
} = require('../usecases/comments/commentsUsecases');

/**
 * @desc    Get comments
 * @route   GET /api/v1/comments
 * @route   GET /api/v1/stickerboards/:belongsToBoard/comments
 * @access  Public
 */
exports.getComments = asyncHandler(async (req, res) => {
  if (req.params.belongsToBoard) {
    const { comments } = await getCommentsForBoard({ boardId: req.params.belongsToBoard });

    return res.status(200).json({
      success: true,
      count: comments.length,
      data: comments,
    });
  }

  // If you request ALL comments it will paginate via advancedResults middleware
  return res.status(200).json(res.advancedResults);
});

/**
 * @desc    Get a single comment
 * @route   GET /api/v1/comments/:id
 * @access  Public
 */
exports.getComment = asyncHandler(async (req, res) => {
  const { comment } = await getCommentById({ commentId: req.params.id });

  res.status(200).json({
    success: true,
    data: comment,
  });
});

/**
 * @desc    Add a comment
 * @route   POST /api/v1/stickerboards/:belongsToBoard/comments
 * @access  Private
 */
exports.addComment = asyncHandler(async (req, res) => {
  const actor = { id: req.user.id, role: req.user.role };

  const { comment } = await addComment({
    boardId: req.params.belongsToBoard,
    actor,
    body: req.body,
  });

  res.status(201).json({
    success: true,
    data: comment,
  });
});

/**
 * @desc    Update a comment
 * @route   PUT /api/v1/comments/:id
 * @access  Private
 */
exports.updateComment = asyncHandler(async (req, res) => {
  const actor = { id: req.user.id, role: req.user.role };

  const { comment } = await updateComment({
    commentId: req.params.id,
    actor,
    body: req.body,
  });

  res.status(200).json({
    success: true,
    data: comment,
  });
});

/**
 * @desc    Delete a comment
 * @route   DELETE /api/v1/comments/:id
 * @access  Private
 */
exports.deleteComment = asyncHandler(async (req, res) => {
  const actor = { id: req.user.id, role: req.user.role };

  await deleteComment({
    commentId: req.params.id,
    actor,
  });

  res.status(200).json({
    success: true,
    data: {},
  });
});
