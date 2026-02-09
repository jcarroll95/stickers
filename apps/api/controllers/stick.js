// apps/api/controllers/stick.js

const asyncHandler = require('../middleware/async');

const { getStix, getStick, addStick, updateStick, deleteStick } = require('../usecases/stix/stixUsecases');

/**
 * @desc    Get stix
 * @route   GET /api/v1/stix
 * @route   GET /api/v1/stickerboards/:belongsToBoard/stix
 * @access  Private
 */
exports.getStix = asyncHandler(async (req, res) => {
  if (req.params.belongsToBoard) {
    const { stix } = await getStix({ boardId: req.params.belongsToBoard });
    return res.status(200).json({ success: true, count: stix.length, data: stix });
  }

  // If you request ALL stix it will paginate via advancedResults
  return res.status(200).json(res.advancedResults);
});

/**
 * @desc    Get stick
 * @route   GET /api/v1/stix/:stickId
 * @access  Private
 */
exports.getStick = asyncHandler(async (req, res) => {
  const { stick } = await getStick({ stickId: req.params.stickId });
  res.status(200).json({ success: true, data: stick });
});

/**
 * @desc    Add a stick
 * @route   POST /api/v1/stix/:belongsToBoard
 * @access  Private
 */
exports.addStick = asyncHandler(async (req, res) => {
  const actor = { id: req.user.id, role: req.user.role };
  const { stick, opId } = await addStick({
    actor,
    boardId: req.params.belongsToBoard,
    body: req.body,
  });

  const response = { success: true, data: stick };
  if (opId) response.opId = opId;

  res.status(200).json(response);
});

/**
 * @desc    Update a stick
 * @route   PUT /api/v1/stix/:stickId
 * @access  Private
 */
exports.updateStick = asyncHandler(async (req, res) => {
  const actor = { id: req.user.id, role: req.user.role };
  const { stick } = await updateStick({
    actor,
    stickId: req.params.stickId,
    body: req.body,
  });

  res.status(200).json({ success: true, data: stick });
});

/**
 * @desc    Delete a stick
 * @route   DELETE /api/v1/stix/:stickId
 * @access  Private
 */
exports.deleteStick = asyncHandler(async (req, res) => {
  const actor = { id: req.user.id, role: req.user.role };
  await deleteStick({ actor, stickId: req.params.stickId });

  res.status(200).json({ success: true, data: {} });
});
