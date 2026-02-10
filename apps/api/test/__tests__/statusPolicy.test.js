const {
  assertValidStickerStatus,
  computeStickerStatusChange,
  ALLOWED_STICKER_STATUSES,
} = require('../../domain/stickers/statusPolicy');

describe('statusPolicy', () => {
  describe('assertValidStickerStatus', () => {
    test('should not throw for valid statuses', () => {
      ALLOWED_STICKER_STATUSES.forEach((status) => {
        expect(() => assertValidStickerStatus(status)).not.toThrow();
      });
    });

    test('should throw 400 for invalid status', () => {
      try {
        assertValidStickerStatus('invalid');
        fail('Should have thrown');
      } catch (err) {
        expect(err.message).toBe('Invalid status');
        expect(err.statusCode).toBe(400);
      }
    });
  });

  describe('computeStickerStatusChange', () => {
    const prev = {
      status: 'staged',
      reviewedAt: null,
      reviewedBy: null,
      activatedAt: null,
      retiredAt: null,
    };
    const now = new Date('2026-02-10T09:00:00Z');
    const actorUserId = 'user123';

    test('should compute changes for "ready" status', () => {
      const result = computeStickerStatusChange({
        prev,
        nextStatus: 'ready',
        actorUserId,
        now,
      });

      expect(result.set.status).toBe('ready');
      expect(result.set.reviewedAt).toBe(now);
      expect(result.set.reviewedBy).toBe(actorUserId);
      expect(result.changes).toContainEqual({ path: 'status', before: 'staged', after: 'ready' });
      expect(result.changes).toContainEqual({ path: 'reviewedAt', before: null, after: now });
      expect(result.changes).toContainEqual({ path: 'reviewedBy', before: null, after: actorUserId });
    });

    test('should compute changes for "active" status', () => {
      const result = computeStickerStatusChange({
        prev,
        nextStatus: 'active',
        actorUserId,
        now,
      });

      expect(result.set.status).toBe('active');
      expect(result.set.activatedAt).toBe(now);
      expect(result.changes).toContainEqual({ path: 'status', before: 'staged', after: 'active' });
      expect(result.changes).toContainEqual({ path: 'activatedAt', before: null, after: now });
    });

    test('should compute changes for "retired" status', () => {
      const result = computeStickerStatusChange({
        prev,
        nextStatus: 'retired',
        actorUserId,
        now,
      });

      expect(result.set.status).toBe('retired');
      expect(result.set.retiredAt).toBe(now);
      expect(result.changes).toContainEqual({ path: 'status', before: 'staged', after: 'retired' });
      expect(result.changes).toContainEqual({ path: 'retiredAt', before: null, after: now });
    });

    test('should handle missing actorUserId when moving to "ready"', () => {
      const result = computeStickerStatusChange({
        prev,
        nextStatus: 'ready',
        now,
      });
      expect(result.set.reviewedBy).toBe(null);
    });
  });
});
