const { assertNonOwnerOnlyAppendingSticker, extractCandidateSticker } = require('../../domain/stickerboards/nonOwnerAppendPolicy');
const { DomainError } = require('../../domain/errors/domainError');

const goodBody = {
  stickers: [{
      stickerId: "aaaaaaaaaaaaaaaaaaaaaaaa",     // supports both Number (legacy) and ObjectId (new)
      imageUrl: "http://media.stickerboards.com/media.1.jpg",                                                     // Persisted URL for inventory stickers
      name: " test sticker ",                                                         // Persisted name
      x: 0,             // normalized or absolute coordinates
      y: 0,
      scale: 1,
      rotation: 0,
      zIndex: 1,
      stuck: true,
      isCheers: true,
      createdAt: Date.now()
  }]
};

const appendBody = {
  stickers: [{
    stickerId: "aaaaaaaaaaaaaaaaaaaaaaaa",     // supports both Number (legacy) and ObjectId (new)
    imageUrl: "http://media.stickerboards.com/media.1.jpg",                                                     // Persisted URL for inventory stickers
    name: " test sticker ",                                                         // Persisted name
    x: 0,             // normalized or absolute coordinates
    y: 0,
    scale: 1,
    rotation: 0,
    zIndex: 1,
    stuck: true,
    isCheers: true,
    createdAt: Date.now()
  },
    {
      stickerId: "bbbbbbbbbbbbbbbbbbbbbbbbbb",     // supports both Number (legacy) and ObjectId (new)
      imageUrl: "http://media.stickerboards.com/media.1.jpg",                                                     // Persisted URL for inventory stickers
      name: " appended sticker ",                                                         // Persisted name
      x: 0,             // normalized or absolute coordinates
      y: 0,
      scale: 1,
      rotation: 0,
      zIndex: 1,
      stuck: true,
      isCheers: true,
      createdAt: Date.now()
    }]
};

const badBody = {
  name: "rename this board!!!"
};

describe('nonOwnerAppendPolicy', () => {
  test('Try to append a sticker to a non-owned board', () => {
    expect(() => assertNonOwnerOnlyAppendingSticker(goodBody)).not.toThrow();
  });
  test('Try to change the name of a non-owned board', () => {
    try {
      assertNonOwnerOnlyAppendingSticker(badBody);
      fail('Should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(DomainError);
      expect(err.statusCode).toBe(400);
    }
  });
  test('Allow extra metadata like opId', () => {
    const bodyWithOpId = { ...goodBody, opId: '123' };
    expect(() => assertNonOwnerOnlyAppendingSticker(bodyWithOpId)).not.toThrow();
  });
  test('Try to pass a null body', () => {
    expect(() => extractCandidateSticker({body: null, existingStickerCount: 0})).toThrow(DomainError);
  });
  test('Try to append a sticker with an invalid body', () => {
    expect(() => extractCandidateSticker({body: badBody, existingStickerCount: 1})).toThrow(DomainError);
  });
  test('Pass the updated body with appended sticker', () => {
  expect(extractCandidateSticker({ body: appendBody, existingStickerCount: 1 })).toEqual(appendBody.stickers[1]);
  });
});
