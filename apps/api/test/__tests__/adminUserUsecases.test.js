// apps/api/test/__tests__/adminUserUsecases.test.js

const mongoose = require('mongoose');

// IMPORTANT: mock dependencies BEFORE importing the usecase module
jest.mock('../../models/User', () => ({
  findById: jest.fn(),
  create: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findByIdAndDelete: jest.fn(),
  findOne: jest.fn(),
}));

jest.mock('../../services/stickerInventory', () => ({
  assignStarterPackToUser: jest.fn(),
}));

// Keep these if your model graph tries to load them indirectly in test env
jest.mock('../../models/StickerDefinition', () => ({}));
jest.mock('../../models/MediaVariant', () => ({}));
jest.mock('../../models/StickerPack', () => ({}));

const {
  getUserById,
  createUser,
  updateUser,
  deleteUser,
} = require('../../usecases/users/adminUserUsecases');

const User = require('../../models/User');
const { assignStarterPackToUser } = require('../../services/stickerInventory');

describe('adminUserUsecases', () => {
  const userId = new mongoose.Types.ObjectId();

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserById', () => {
    test('returns user if found', async () => {
      const mockUser = { _id: userId, name: 'Admin' };
      User.findById.mockResolvedValue(mockUser);

      const result = await getUserById({ userId });

      expect(User.findById).toHaveBeenCalledWith(userId);
      expect(result.user).toBe(mockUser);
    });
  });

  describe('createUser', () => {
    test('creates user and assigns starter pack', async () => {
      const mockUser = { _id: userId, name: 'New' };
      User.create.mockResolvedValue(mockUser);
      assignStarterPackToUser.mockResolvedValue({});

      const result = await createUser({
        body: { name: 'New', email: 'n@ex.com', password: 'password123' },
      });

      expect(User.create).toHaveBeenCalled();

      // robust to ObjectId vs string id
      expect(assignStarterPackToUser).toHaveBeenCalledTimes(1);
      const calledWith = assignStarterPackToUser.mock.calls[0][0];
      expect(String(calledWith)).toBe(String(userId));

      expect(result.user).toBe(mockUser);
    });
  });

  describe('updateUser', () => {
    test('updates user fields', async () => {
      const mockUser = { _id: userId, name: 'Updated' };
      User.findByIdAndUpdate.mockResolvedValue(mockUser);

      const result = await updateUser({ userId, body: { name: 'Updated' } });

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        userId,
        expect.objectContaining({ name: 'Updated' }),
        expect.any(Object)
      );
      expect(result.user).toBe(mockUser);
    });
  });

  describe('deleteUser', () => {
    test('deletes user by id', async () => {
      User.findByIdAndDelete.mockResolvedValue({});

      const result = await deleteUser({ userId });

      expect(User.findByIdAndDelete).toHaveBeenCalledWith(userId);
      expect(result.deleted).toBe(true);
    });
  });
});
