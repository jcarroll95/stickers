const { updateStickerboardUseCase } = require('../../usecases/stickerboards/updateStickerboard');
const Stickerboard = require('../../models/Stickerboard');
const mongoose = require('mongoose');
const { consumeCheersStickerForNonOwner, consumeInventoryStickerIfAppending } = require('../../usecases/stickers/consumeStickerForPlacement');

jest.mock('../../models/Stickerboard');
jest.mock('../../usecases/stickers/consumeStickerForPlacement');

// Mock mongoose session
const mockSession = {
  startTransaction: jest.fn(),
  commitTransaction: jest.fn(),
  abortTransaction: jest.fn(),
  endSession: jest.fn(),
  inTransaction: jest.fn().mockReturnValue(true),
};
mongoose.startSession = jest.fn().mockResolvedValue(mockSession);

describe('updateStickerboardUseCase', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('updates board as owner', async () => {
    const actor = { id: 'owner123', role: 'user' };
    const boardId = 'board123';
    const body = { name: 'New Name' };

    Stickerboard.findById.mockReturnValue({
      session: jest.fn().mockResolvedValue({
        _id: boardId,
        user: 'owner123',
        stickers: []
      })
    });
    // For the findOne dummy check
    Stickerboard.findOne.mockReturnValue({ session: jest.fn().mockResolvedValue({}) });

    Stickerboard.findOneAndUpdate.mockResolvedValue({ _id: boardId, name: 'New Name' });

    const result = await updateStickerboardUseCase({ actor, boardId, body });

    expect(Stickerboard.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: boardId },
      expect.objectContaining({ name: 'New Name' }),
      expect.any(Object)
    );
    expect(result.name).toBe('New Name');
  });

  test('non-owner appends cheers sticker and consumes it', async () => {
    const actor = { id: 'guest123', role: 'user' };
    const boardId = 'board123';
    const body = { stickers: [{ stickerId: 1, x: 0, y: 0 }] }; // Non-owner append

    Stickerboard.findById.mockReturnValue({
      session: jest.fn().mockResolvedValue({
        _id: boardId,
        user: 'owner123',
        stickers: []
      })
    });
    Stickerboard.findOne.mockReturnValue({ session: jest.fn().mockResolvedValue({}) });
    Stickerboard.findOneAndUpdate.mockResolvedValue({ _id: boardId, stickers: [body.stickers[0]] });

    const result = await updateStickerboardUseCase({ actor, boardId, body });

    expect(consumeCheersStickerForNonOwner).toHaveBeenCalled();
    expect(Stickerboard.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: boardId },
      { $push: { stickers: expect.any(Object) } },
      expect.any(Object)
    );
  });

  test('throws 404 if board not found', async () => {
    Stickerboard.findById.mockReturnValue({ session: jest.fn().mockResolvedValue(null) });
    Stickerboard.findOne.mockReturnValue({ session: jest.fn().mockResolvedValue({}) });

    await expect(updateStickerboardUseCase({ actor: { id: 'u' }, boardId: 'missing', body: {} }))
      .rejects.toThrow('Stickerboard not found');
  });
});
