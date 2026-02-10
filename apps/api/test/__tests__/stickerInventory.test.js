jest.mock('../../models/StickerDefinition', () => ({}), { virtual: true });
jest.mock('../../models/MediaVariant', () => ({}), { virtual: true });
jest.mock('../../models/StickerPack', () => ({}), { virtual: true });
const {
  getUserInventoryAndCatalog: getUserInventoryAndCatalogController,
  addStickerToInventory: addStickerToInventoryController,
  removeStickerFromInventory: removeStickerFromInventoryController,
  addPackToInventory: addPackToInventoryController,
  removePackFromInventory: removePackFromInventoryController,
} = require('../../controllers/stickerInventory');

const {
  getUserInventoryAndCatalog,
  addStickerToInventory,
  removeStickerFromInventory,
  addPackToInventory,
  removePackFromInventory,
} = require('../../usecases/inventory/adminInventoryUsecases');

jest.mock('../../usecases/inventory/adminInventoryUsecases');

describe('stickerInventory Controller (Admin)', () => {
  let req, res;

  beforeEach(() => {
    req = { params: {}, body: {} };
    res = {
      json: jest.fn().mockReturnThis(),
      status: jest.fn().mockReturnThis(),
    };
    jest.clearAllMocks();
  });

  test('getUserInventoryAndCatalog calls usecase and returns data', async () => {
    req.params.identifier = 'user@example.com';
    const mockData = { user: {}, inventory: [], catalog: {} };
    getUserInventoryAndCatalog.mockResolvedValue(mockData);

    await getUserInventoryAndCatalogController(req, res);

    expect(getUserInventoryAndCatalog).toHaveBeenCalledWith({ identifier: 'user@example.com' });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: mockData });
  });

  test('addStickerToInventory calls usecase and returns entry', async () => {
    req.body = { userId: 'u1', stickerId: 's1', quantity: 5 };
    const mockEntry = { userId: 'u1', quantity: 5 };
    addStickerToInventory.mockResolvedValue(mockEntry);

    await addStickerToInventoryController(req, res);

    expect(addStickerToInventory).toHaveBeenCalledWith({ userId: 'u1', stickerId: 's1', quantity: 5, req });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: mockEntry });
  });

  test('removeStickerFromInventory calls usecase', async () => {
    req.body = { userId: 'u1', stickerId: 's1', quantity: 1 };
    removeStickerFromInventory.mockResolvedValue({ deleted: true });

    await removeStickerFromInventoryController(req, res);

    expect(removeStickerFromInventory).toHaveBeenCalledWith({ userId: 'u1', stickerId: 's1', quantity: 1, req });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: {} });
  });

  test('addPackToInventory calls usecase', async () => {
    req.body = { userId: 'u1', packId: 'p1' };
    addPackToInventory.mockResolvedValue();

    await addPackToInventoryController(req, res);

    expect(addPackToInventory).toHaveBeenCalledWith({ userId: 'u1', packId: 'p1', req });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: {} });
  });

  test('removePackFromInventory calls usecase', async () => {
    req.body = { userId: 'u1', packId: 'p1' };
    removePackFromInventory.mockResolvedValue();

    await removePackFromInventoryController(req, res);

    expect(removePackFromInventory).toHaveBeenCalledWith({ userId: 'u1', packId: 'p1', req });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, data: {} });
  });
});
