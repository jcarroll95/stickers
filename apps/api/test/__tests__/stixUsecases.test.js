const {
  addStick,
  getStick,
  updateStick,
  deleteStick,
} = require('../../usecases/stix/stixUsecases');
const Stick = require('../../models/Stick');
const Stickerboard = require('../../models/Stickerboard');
const StickerPack = require('../../models/StickerPack');
const mongoose = require('mongoose');

jest.mock('../../models/Stick');
jest.mock('../../models/Stickerboard');
jest.mock('../../models/StickerPack');

// Mock mongoose session
const mockSession = {
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  abortTransaction: jest.fn(),
  endSession: jest.fn(),
  inTransaction: jest.fn().mockReturnValue(true),
};
mongoose.startSession = jest.fn().mockResolvedValue(mockSession);

describe('stixUsecases', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('addStick', () => {
    test('adds a stick and updates board palette if owner', async () => {
      const actor = { id: 'user123', role: 'user' };
      const boardId = 'board123';
      const body = { stickNumber: 1, opId: 'op1' };

      Stickerboard.findById.mockReturnValue({
        session: jest.fn().mockResolvedValue({
          _id: boardId,
          user: 'user123',
          stickers: []
        })
      });
      // For the findOne dummy check
      Stickerboard.findOne.mockReturnValue({ session: jest.fn().mockResolvedValue({}) });

      const mockNewStick = { _id: 'stick123', stickNumber: 1 };
      Stick.create.mockResolvedValue([mockNewStick]);

      const result = await addStick({ actor, boardId, body });

      expect(Stick.create).toHaveBeenCalled();
      expect(Stickerboard.findByIdAndUpdate).toHaveBeenCalledWith(
        boardId,
        { $push: { stickers: expect.any(Object) } },
        expect.any(Object)
      );
      expect(result.stick).toBe(mockNewStick);
      expect(result.opId).toBe('op1');
    });

    test('throws 401 if not authorized', async () => {
      const actor = { id: 'otherUser', role: 'user' };
      Stickerboard.findById.mockReturnValue({
        session: jest.fn().mockResolvedValue({
          _id: 'board123',
          user: 'owner123',
        })
      });
      Stickerboard.findOne.mockReturnValue({ session: jest.fn().mockResolvedValue({}) });

      await expect(addStick({ actor, boardId: 'board123', body: {} }))
        .rejects.toThrow('not authorized');
    });
  });

  describe('getStick', () => {
    test('returns stick with populated board', async () => {
      const mockStick = { _id: 's1' };
      Stick.findById.mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockStick)
      });

      const result = await getStick({ stickId: 's1' });
      expect(result.stick).toBe(mockStick);
    });
  });

  describe('deleteStick', () => {
    test('deletes stick if owner', async () => {
      const mockStick = {
        user: 'user123',
        deleteOne: jest.fn().mockResolvedValue({})
      };
      Stick.findById.mockResolvedValue(mockStick);

      const result = await deleteStick({ actor: { id: 'user123' }, stickId: 's1' });
      expect(mockStick.deleteOne).toHaveBeenCalled();
      expect(result.deleted).toBe(true);
    });
  });
});
