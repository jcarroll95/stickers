const {
  getUserById,
  createUser,
  updateUser,
  deleteUser,
} = require('../../usecases/users/adminUserUsecases');
const User = require('../../models/User');
const { assignStarterPackToUser } = require('../../services/stickerInventory');

jest.mock('../../models/User');
jest.mock('../../services/stickerInventory');

describe('adminUserUsecases', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserById', () => {
    test('returns user if found', async () => {
      const mockUser = { _id: 'u1', name: 'Admin' };
      User.findById.mockResolvedValue(mockUser);

      const result = await getUserById({ userId: 'u1' });
      expect(result.user).toBe(mockUser);
    });
  });

  describe('createUser', () => {
    test('creates user and assigns starter pack', async () => {
      const mockUser = { _id: 'u1', name: 'New' };
      User.create.mockResolvedValue(mockUser);
      assignStarterPackToUser.mockResolvedValue({});

      const result = await createUser({ body: { name: 'New', email: 'n@ex.com', password: 'pw' } });

      expect(User.create).toHaveBeenCalled();
      expect(assignStarterPackToUser).toHaveBeenCalledWith('u1');
      expect(result.user).toBe(mockUser);
    });
  });

  describe('updateUser', () => {
    test('updates user fields', async () => {
      const mockUser = { _id: 'u1', name: 'Updated' };
      User.findByIdAndUpdate.mockResolvedValue(mockUser);

      const result = await updateUser({ userId: 'u1', body: { name: 'Updated' } });

      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        'u1',
        expect.objectContaining({ name: 'Updated' }),
        expect.any(Object)
      );
      expect(result.user).toBe(mockUser);
    });
  });

  describe('deleteUser', () => {
    test('deletes user by id', async () => {
      User.findByIdAndDelete.mockResolvedValue({});

      const result = await deleteUser({ userId: 'u1' });

      expect(User.findByIdAndDelete).toHaveBeenCalledWith('u1');
      expect(result.deleted).toBe(true);
    });
  });
});
