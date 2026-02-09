// apps/api/usecases/users/adminUserUsecases.js

const ErrorResponse = require('../../utils/errorResponse');
const User = require('../../models/User');
const { assignStarterPackToUser } = require('../../services/stickerInventory');

const { CREATE_USER_FIELDS, UPDATE_USER_FIELDS, pickAllowedFields } = require('../../domain/users/userFields');

/**
 * Get a user by id.
 * @param {{ userId: string }} args
 */
async function getUserById({ userId }) {
  if (!userId) throw new ErrorResponse('userId is required', 400);

  const user = await User.findById(userId);
  // Keep your previous behavior (no 404). If you want stricter admin UX, uncomment:
  // if (!user) throw new ErrorResponse(`User not found with id ${userId}`, 404);

  return { user };
}

/**
 * Create a user (admin).
 * Assign starter pack after creation.
 *
 * @param {{ body: any }} args
 */
async function createUser({ body }) {
  const userData = pickAllowedFields(body, CREATE_USER_FIELDS);

  const user = await User.create(userData);

  // Side effect: starter pack
  await assignStarterPackToUser(user._id);

  return { user };
}

/**
 * Update a user (admin).
 * @param {{ userId: string, body: any }} args
 */
async function updateUser({ userId, body }) {
  if (!userId) throw new ErrorResponse('userId is required', 400);

  const updateData = pickAllowedFields(body, UPDATE_USER_FIELDS);

  const user = await User.findByIdAndUpdate(userId, updateData, {
    new: true,
    runValidators: true,
  });

  return { user };
}

/**
 * Delete a user (admin).
 * @param {{ userId: string }} args
 */
async function deleteUser({ userId }) {
  if (!userId) throw new ErrorResponse('userId is required', 400);

  await User.findByIdAndDelete(userId);
  return { deleted: true };
}

module.exports = { getUserById, createUser, updateUser, deleteUser };
