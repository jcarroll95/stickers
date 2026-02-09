const { choosePaletteStickerId, buildPaletteSticker } = require('../../domain/stickerboards/palette');

const idA = 'aaaaaaaaaaaaaaaaaaaaaaaa'
const idB = 'bbbbbbbbbbbbbbbbbbbbbbbb'
const idC = 'cccccccccccccccccccccccc'

describe('choosePaletteStickerId', () => {
  test('deterministic mapping by stick number', () => {
    const chooseObj = {
      stickNumber: 4,
      existingStickers: [],
      paletteStickerIds: [idA, idB, idC]
    }
    expect(choosePaletteStickerId(chooseObj)).toEqual(chooseObj.paletteStickerIds[4 % 3]);
  });

  test('non-numeric sticker number chooses first unused sticker', () => {
    const chooseObj = {
      stickNumber: "abc",
      existingStickers: [{ stickerId: idA}, {stickerId: idC}],
      paletteStickerIds: [idA, idB, idC]
    }
    expect(choosePaletteStickerId(chooseObj)).toEqual(idB);
  });

  test('all stickers are used, fall back to first', () => {
    const chooseObj = {
      stickNumber: null,
      existingStickers: [{ stickerId: idA}, {stickerId: idB}],
      paletteStickerIds: [idA, idB]
    }
    expect(choosePaletteStickerId(chooseObj)).toEqual(idA);
  });

  test('preserve legacy sticker id fallback', () => {
    const chooseObj = {
      stickNumber: 12,
      existingStickers: [],
      paletteStickerIds: []
    }
    expect(choosePaletteStickerId(chooseObj)).toEqual(((chooseObj.stickNumber % 10) + 10) % 10 );
  });
});


describe('buildPaletteSticker', () => {
  test('build a new palette sticker now', () => {
    const stickerId = idA;
    const now = new Date();
    expect(buildPaletteSticker({ stickerId, now })).toEqual({
      stickerId,
      x: 0,
      y: 0,
      scale: 1,
      rotation: 0,
      zIndex: 0,
      stuck: false,
      createdAt: now
    });
  });
});
