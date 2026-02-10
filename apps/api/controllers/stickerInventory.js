// apps/api/controllers/stickerInventory.js

const asyncHandler = require('../middleware/async');

const {
  getUserInventoryAndCatalog,
  addStickerToInventory,
  removeStickerFromInventory,
  addPackToInventory,
  removePackFromInventory,
} = require('../usecases/inventory/adminInventoryUsecases');

// @desc    Get user inventory and full catalog
// @route   GET /api/v1/admin/inventory/:identifier
// @access  Private/Admin
exports.getUserInventoryAndCatalog = asyncHandler(async (req, res) => {
  const { identifier } = req.params;

  const data = await getUserInventoryAndCatalog({ identifier });

  res.status(200).json({
    success: true,
    data,
  });
});

// @desc    Add sticker to user inventory
// @route   POST /api/v1/admin/inventory/add-sticker
// @access  Private/Admin
exports.addStickerToInventory = asyncHandler(async (req, res) => {
  const { userId, stickerId, quantity = 1 } = req.body;

  const inventoryEntry = await addStickerToInventory({ userId, stickerId, quantity, req });

  res.status(200).json({
    success: true,
    data: inventoryEntry,
  });
});

// @desc    Remove sticker from user inventory
// @route   POST /api/v1/admin/inventory/remove-sticker
// @access  Private/Admin
exports.removeStickerFromInventory = asyncHandler(async (req, res) => {
  const { userId, stickerId, quantity = 1 } = req.body;

  await removeStickerFromInventory({ userId, stickerId, quantity, req });

  res.status(200).json({
    success: true,
    data: {},
  });
});

// @desc    Add entire pack to user inventory
// @route   POST /api/v1/admin/inventory/add-pack
// @access  Private/Admin
exports.addPackToInventory = asyncHandler(async (req, res) => {
  const { userId, packId } = req.body;

  await addPackToInventory({ userId, packId, req });

  res.status(200).json({
    success: true,
    data: {},
  });
});

// @desc    Remove entire pack from user inventory
// @route   POST /api/v1/admin/inventory/remove-pack
// @access  Private/Admin
exports.removePackFromInventory = asyncHandler(async (req, res) => {
  const { userId, packId } = req.body;

  await removePackFromInventory({ userId, packId, req });

  res.status(200).json({
    success: true,
    data: {},
  });
});
