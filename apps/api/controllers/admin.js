// apps/api/controllers/admin.js

const asyncHandler = require('../middleware/async');
const { getMetrics } = require('../middleware/performance');

// @desc    Get performance metrics
// @route   GET /api/v1/admin/metrics
// @access  Private/Admin
exports.getMetrics = asyncHandler(async (req, res) => {
  const metrics = getMetrics();

  res.status(200).json({
    success: true,
    data: metrics,
  });
});
