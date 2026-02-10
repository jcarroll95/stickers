// apps/api/test/__tests__/updateStickerStatus.test.js

const mongoose = require('mongoose');

// Mock deps BEFORE importing the usecase module
jest.mock('../../models/StickerDefinition', () => ({
  findById: jest.fn(),
}));

jest.mock('../../utils/audit', () => ({
  emitAuditEvent: jest.fn().mockResolvedValue(undefined),
}));

// Keep if something in your model graph tries to load it during tests
jest.mock('../../models/MediaVariant', () => ({}));

const { updateStickerStatus } = require('../../usecases/admin/stickers/updateStickerStatus');

const StickerDefinition = require('../../models/StickerDefinition');
const { emitAuditEvent } = require('../../utils/audit');

describe('updateStickerStatus usecase', () => {
  const stickerId = new mongoose.Types.ObjectId();

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should update sticker status and lifecycle fields', async () => {
    const mockSticker = {
      _id: stickerId,
      status: 'staged',
      stickerKey: 'test-sticker',
      save: jest.fn().mockResolvedValue(true),
    };

    StickerDefinition.findById.mockResolvedValue(mockSticker);

    const result = await updateStickerStatus({
      actor: { id: 'admin1' },
      stickerId,
      nextStatus: 'ready',
      reqForAudit: { id: 'req1', headers: {} },
    });

    expect(StickerDefinition.findById).toHaveBeenCalledWith(stickerId);

    expect(mockSticker.status).toBe('ready');
    expect(mockSticker.reviewedAt).toBeDefined();
    expect(mockSticker.reviewedBy).toBe('admin1');
    expect(mockSticker.save).toHaveBeenCalledTimes(1);

    expect(emitAuditEvent).toHaveBeenCalledTimes(1);
    expect(emitAuditEvent).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: 'sticker.status_change',
        entityType: 'StickerDefinition',
        changes: expect.arrayContaining([
          expect.objectContaining({ path: 'status', before: 'staged', after: 'ready' }),
        ]),
      })
    );

    expect(result.sticker).toBe(mockSticker);
  });

  test('should throw 404 if sticker not found', async () => {
    StickerDefinition.findById.mockResolvedValue(null);

    await expect(
      updateStickerStatus({ stickerId, nextStatus: 'active' })
    ).rejects.toThrow('Sticker not found');
  });

  test('should throw if status is invalid', async () => {
    await expect(
      updateStickerStatus({ stickerId, nextStatus: 'invalid' })
    ).rejects.toThrow('Invalid status');
  });
});
