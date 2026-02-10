const {
  getCommentsForBoard,
  addComment,
  updateComment,
  deleteComment,
} = require('../../usecases/comments/commentsUsecases');
const Comment = require('../../models/Comment');
const Stickerboard = require('../../models/Stickerboard');
const ErrorResponse = require('../../utils/errorResponse');

jest.mock('../../models/Comment');
jest.mock('../../models/Stickerboard');

describe('commentsUsecases', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getCommentsForBoard', () => {
    test('returns comments for a specific board', async () => {
      const mockComments = [{ comment: 'nice' }];
      Comment.find.mockResolvedValue(mockComments);

      const result = await getCommentsForBoard({ boardId: 'board123' });

      expect(Comment.find).toHaveBeenCalledWith({ belongsToBoard: 'board123' });
      expect(result.comments).toBe(mockComments);
    });
  });

  describe('addComment', () => {
    test('adds a comment if board exists', async () => {
      Stickerboard.findById.mockResolvedValue({ _id: 'board123' });
      Comment.create.mockResolvedValue({ comment: 'hi' });

      const actor = { id: 'user123' };
      const body = { comment: 'hi', commentRating: 5 };
      const result = await addComment({ boardId: 'board123', actor, body });

      expect(Comment.create).toHaveBeenCalledWith(expect.objectContaining({
        belongsToBoard: 'board123',
        belongsToUser: 'user123',
        comment: 'hi'
      }));
      expect(result.comment).toBeDefined();
    });

    test('throws 404 if board not found', async () => {
      Stickerboard.findById.mockResolvedValue(null);
      await expect(addComment({ boardId: 'none', actor: {}, body: {} })).rejects.toThrow(ErrorResponse);
    });
  });

  describe('updateComment', () => {
    test('updates comment if owner', async () => {
      const mockComment = {
        _id: 'comm123',
        belongsToUser: 'user123',
      };
      Comment.findById.mockResolvedValue(mockComment);
      Comment.findByIdAndUpdate.mockResolvedValue({ ...mockComment, comment: 'updated' });

      const actor = { id: 'user123' };
      const body = { comment: 'updated' };
      const result = await updateComment({ commentId: 'comm123', actor, body });

      expect(result.comment.comment).toBe('updated');
    });

    test('updates comment if admin but not owner', async () => {
      const mockComment = {
        _id: 'comm123',
        belongsToUser: 'user123',
      };
      Comment.findById.mockResolvedValue(mockComment);
      Comment.findByIdAndUpdate.mockResolvedValue({ ...mockComment, comment: 'admin-updated' });

      const actor = { id: 'admin456', role: 'admin' };
      const result = await updateComment({ commentId: 'comm123', actor, body: { comment: 'admin-updated' } });

      expect(result.comment.comment).toBe('admin-updated');
    });

    test('throws 401 if neither owner nor admin', async () => {
      const mockComment = {
        _id: 'comm123',
        belongsToUser: 'user123',
      };
      Comment.findById.mockResolvedValue(mockComment);

      const actor = { id: 'user456', role: 'user' };
      await expect(updateComment({ commentId: 'comm123', actor, body: {} })).rejects.toThrow('Not authorized');
    });
  });

  describe('deleteComment', () => {
    test('deletes comment if owner', async () => {
      const mockComment = {
        _id: 'comm123',
        belongsToUser: 'user123',
        deleteOne: jest.fn().mockResolvedValue({}),
      };
      Comment.findById.mockResolvedValue(mockComment);

      const result = await deleteComment({ commentId: 'comm123', actor: { id: 'user123' } });

      expect(mockComment.deleteOne).toHaveBeenCalled();
      expect(result.deleted).toBe(true);
    });
  });
});
