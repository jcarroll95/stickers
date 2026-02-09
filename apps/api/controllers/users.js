// apps/api/controllers/users.js

const asyncHandler = require('../middleware/async');

const {
  getUserById,
  createUser,
  updateUser,
  deleteUser,
} = require('../usecases/users/adminUserUsecases');

/**
 * @desc    Get all users
 * @route   GET /api/v1/auth/users
 * @access  Private/Admin
 */
exports.getUsers = asyncHandler(async (req, res) => {
  res.status(200).json(res.advancedResults);
});

/**
 * @desc    Get one user
 * @route   GET /api/v1/auth/users/:id
 * @access  Private/Admin
 */
exports.getUser = asyncHandler(async (req, res) => {
  const { user } = await getUserById({ userId: req.params.id });

  res.status(200).json({
    success: true,
    data: user,
  });
});

/**
 * @desc    Create user
 * @route   POST /api/v1/auth/users
 * @access  Private/Admin
 */
exports.createUser = asyncHandler(async (req, res) => {
  const { user } = await createUser({ body: req.body });

  res.status(201).json({
    success: true,
    data: user,
  });
});

/**
 * @desc    Update user
 * @route   PUT /api/v1/auth/users/:id
 * @access  Private/Admin
 */
exports.updateUser = asyncHandler(async (req, res) => {
  const { user } = await updateUser({ userId: req.params.id, body: req.body });

  res.status(200).json({
    success: true,
    data: user,
  });
});

/**
 * @desc    Delete user
 * @route   DELETE /api/v1/auth/users/:id
 * @access  Private/Admin
 */
exports.deleteUser = asyncHandler(async (req, res) => {
  await deleteUser({ userId: req.params.id });

  res.status(200).json({
    success: true,
    data: {},
  });
});
