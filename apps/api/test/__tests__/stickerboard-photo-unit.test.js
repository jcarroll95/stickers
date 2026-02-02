const { stickerboardPhotoUpload } = require('../../controllers/stickerboard');

// Mock Stickerboard model so controller ownership check passes and DB isn’t touched
jest.mock('../../models/Stickerboard', () => ({
  findById: jest.fn(async (id) => ({
    _id: id,
    user: { toString: () => 'owner-id' },
  })),
  findByIdAndUpdate: jest.fn(async () => ({})),
}));

describe('stickerboardPhotoUpload negative branches (unit)', () => {
  function buildRes() {
    return {
      statusCode: 200,
      body: null,
      status(code) { this.statusCode = code; return this; },
      json(payload) { this.body = payload; return this; }
    };
  }

  test('rejects non-image mimetype with 400', async () => {
    const req = {
      params: { id: 'board-id' },
      user: { id: 'owner-id', role: 'vipuser' },
      files: { file: { mimetype: 'text/plain', size: 100, name: 'file.txt' } },
    };
    const res = buildRes();
    const next = jest.fn();

    await stickerboardPhotoUpload(req, res, next);
    expect(next).toHaveBeenCalled();
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(400);
    expect(String(err.message || '')).toMatch(/please upload an image/i);
  });

  test('rejects oversize file with 400', async () => {
    const prev = process.env.MAX_FILE_UPLOAD;
    process.env.MAX_FILE_UPLOAD = '100';

    const req = {
      params: { id: 'board-id' },
      user: { id: 'owner-id', role: 'vipuser' },
      files: { file: { mimetype: 'image/png', size: 101, name: 'file.png' } },
    };
    const res = buildRes();
    const next = jest.fn();

    await stickerboardPhotoUpload(req, res, next);
    expect(next).toHaveBeenCalled();
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(400);
    expect(String(err.message || '')).toMatch(/smaller than/i);

    process.env.MAX_FILE_UPLOAD = prev;
  });

  test('mv callback error returns 500', async () => {
    const req = {
      params: { id: 'board-id' },
      user: { id: 'owner-id', role: 'vipuser' },
      files: {
        file: {
          mimetype: 'image/jpeg',
          size: 50,
          name: 'photo.jpg',
          mv: (dest, cb) => cb(new Error('disk full'))
        }
      }
    };
    const res = buildRes();
    const next = jest.fn();

    await stickerboardPhotoUpload(req, res, next);
    expect(next).toHaveBeenCalled();
    const err = next.mock.calls[0][0];
    expect(err.statusCode).toBe(500);
    expect(String(err.message || '')).toMatch(/problem with file upload/i);
  });

  test('successful upload sets filename and returns 200', async () => {
    const prevPath = process.env.FILE_UPLOAD_PATH;
    process.env.FILE_UPLOAD_PATH = '/tmp';

    const req = {
      params: { id: 'board-id' },
      user: { id: 'owner-id', role: 'vipuser' },
      files: {
        file: {
          mimetype: 'image/png',
          size: 50,
          name: 'my.png',
          mv: (dest, cb) => cb(null)
        }
      }
    };
    const res = buildRes();
    const next = jest.fn();

    await stickerboardPhotoUpload(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(String(res.body.data)).toMatch(/^photo_board-id\.png$/);

    process.env.FILE_UPLOAD_PATH = prevPath;
  });
});
