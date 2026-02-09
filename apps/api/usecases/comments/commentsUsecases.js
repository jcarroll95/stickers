// apps/api/usecases/comments/commentsUsecases.js

const ErrorResponse = require('../../utils/errorResponse');
const Comment = require('../../models/Comment');
const Stickerboard = require('../../models/Stickerboard');

/**
 * Get comments for a board (non-paginated, current behavior).
 * @param {{ boardId: string }} args
 */
async function getCommentsForBoard({ boardId }) {
  const comments = await Comment.find({ belongsToBoard: boardId });
  return { comments };
}

/**
 * Get a single comment with populated board name/description.
 * @param {{ commentId: string }} args
 */
async function getCommentById({ commentId }) {
  const comment = await Comment.findById(commentId).populate({
    path: 'belongsToBoard',
    select: 'name description',
  });

  if (!comment) {
    throw new ErrorResponse(`No comment found with id ${commentId}`, 404);
  }

  return { comment };
}

/**
 * Add a comment to a stickerboard.
 * @param {{ boardId: string, actor: { id: string }, body: any }} args
 */
async function addComment({ boardId, actor, body }) {
  const stickerboard = await Stickerboard.findById(boardId);
  if (!stickerboard) {
    throw new ErrorResponse(`No stickerboard with id ${boardId}`, 404);
  }

  // Field allowlist
  const commentData = {
    belongsToBoard: boardId,
    belongsToUser: actor.id,
    commentRating: body?.commentRating,
    comment: body?.comment,
  };

  const comment = await Comment.create(commentData);
  return { comment };
}

/**
 * Update a comment.
 * @param {{ commentId: string, actor: { id: string, role: string }, body: any }} args
 */
async function updateComment({ commentId, actor, body }) {
  let comment = await Comment.findById(commentId);
  if (!comment) {
    throw new ErrorResponse(`No comment with id ${commentId}`, 404);
  }

  const isOwner = comment.belongsToUser.toString() === actor.id;
  const isAdmin = actor.role === 'admin';
  if (!isOwner && !isAdmin) {
    throw new ErrorResponse(`Not authorized to update comment ${commentId}`, 401);
  }

  // Field allowlist
  const updateData = {
    commentRating: body?.commentRating,
    comment: body?.comment,
  };

  comment = await Comment.findByIdAndUpdate(commentId, updateData, {
    new: true,
    runValidators: true,
  });

  return { comment };
}

/**
 * Delete a comment.
 * @param {{ commentId: string, actor: { id: string, role: string } }} args
 */
async function deleteComment({ commentId, actor }) {
  const comment = await Comment.findById(commentId);
  if (!comment) {
    throw new ErrorResponse(`No comment with id ${commentId}`, 404);
  }

  const isOwner = comment.belongsToUser.toString() === actor.id;
  const isAdmin = actor.role === 'admin';
  if (!isOwner && !isAdmin) {
    throw new ErrorResponse(`Not authorized to update comment ${commentId}`, 401);
  }

  await comment.deleteOne();
  return { deleted: true };
}

module.exports = {
  getCommentsForBoard,
  getCommentById,
  addComment,
  updateComment,
  deleteComment,
};
