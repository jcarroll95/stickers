const { buildCheersSticker } = require('../../domain/stickers/buildCheersSticker.js');

describe('buildCheersSticker', () => {
  test('returns null for non-object input', () => {
    expect(buildCheersSticker(55)).toBeNull();
    expect(buildCheersSticker(null)).toBeNull();
    expect(buildCheersSticker(undefined)).toBeNull();
  });

  test('returns a valid sticker object for a valid input (including createdAt)', () => {
    const goodInput = {
      stickerId: '1234567890abcdef12345678',
      imageUrl: 'https://media.stickerboards.com/blah/1.jpg',
      name: 'Get some!',
      x: 0,
      y: 0,
      scale: 1,
      rotation: 0,
      zIndex: 0,
      stuck: true,
      isCheers: true,
    };

    const before = Date.now();
    const result = buildCheersSticker(goodInput);
    const after = Date.now();

    // Basic existence
    expect(result).not.toBeNull();
    expect(typeof result).toBe('object');

    // Deterministic fields
    expect(result.stickerId).toBe(goodInput.stickerId);
    expect(result.imageUrl).toBe(goodInput.imageUrl);
    expect(result.name).toBe(goodInput.name);
    expect(result.x).toBe(goodInput.x);
    expect(result.y).toBe(goodInput.y);
    expect(result.scale).toBe(goodInput.scale);
    expect(result.rotation).toBe(goodInput.rotation);
    expect(result.zIndex).toBe(goodInput.zIndex);
    expect(result.stuck).toBe(true);
    expect(result.isCheers).toBe(true);

    // createdAt: assert type + bounded time window (recommended approach)
    expect(result.createdAt).toBeInstanceOf(Date);
    const createdMs = result.createdAt.getTime();
    expect(createdMs).toBeGreaterThanOrEqual(before);
    expect(createdMs).toBeLessThanOrEqual(after);
  });

  test('applies defaults for optional numeric fields when missing/invalid', () => {
    const input = {
      stickerId: '1234567890abcdef12345678',
      imageUrl: 'https://media.stickerboards.com/blah/1.jpg',
      name: 'Defaults test',
      x: 10,
      y: 20,
      // intentionally omit scale/rotation/zIndex
      stuck: true,
      isCheers: true,
    };

    const result = buildCheersSticker(input);

    expect(result).not.toBeNull();
    expect(result.scale).toBe(1);
    expect(result.rotation).toBe(0);
    expect(result.zIndex).toBe(0);
    expect(result.createdAt).toBeInstanceOf(Date);
  });
});
