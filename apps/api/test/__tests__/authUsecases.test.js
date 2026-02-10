const {
  register,
  login,
  forgotPassword,
  resetPassword,
  registerStart,
  registerVerify,
} = require('../../usecases/auth/authUsecases');
const User = require('../../models/User');
const sendEmail = require('../../utils/sendEmail');
const ErrorResponse = require('../../utils/errorResponse');

jest.mock('../../models/User');
jest.mock('../../utils/sendEmail');

describe('authUsecases', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    test('creates a user and returns token and user object', async () => {
      const userData = { name: 'Test', email: 'test@example.com', password: 'password' };
      const userMock = {
        getSignedJwtToken: jest.fn().mockReturnValue('mock-token'),
      };
      User.create.mockResolvedValue(userMock);

      const result = await register(userData);

      expect(User.create).toHaveBeenCalledWith(expect.objectContaining({ name: 'Test' }));
      expect(result.token).toBe('mock-token');
      expect(result.user).toBe(userMock);
    });
  });

  describe('login', () => {
    test('throws 400 if email or password missing', async () => {
      await expect(login({ email: '' })).rejects.toThrow(ErrorResponse);
    });

    test('throws 401 if user not found', async () => {
      User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
      await expect(login({ email: 'no@ex.com', password: 'pw' })).rejects.toThrow('Invalid credentials');
    });

    test('throws 403 if user not verified', async () => {
      const userMock = {
        matchPassword: jest.fn().mockResolvedValue(true),
        isVerified: false,
      };
      User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(userMock) });

      await expect(login({ email: 'u@ex.com', password: 'pw' })).rejects.toThrow('verify your email');
    });
  });

  describe('forgotPassword', () => {
    test('sends email and returns sent: true', async () => {
      const userMock = {
        email: 'test@ex.com',
        getResetPasswordToken: jest.fn().mockReturnValue('reset-token'),
        save: jest.fn().mockResolvedValue(true),
      };
      User.findOne.mockResolvedValue(userMock);
      sendEmail.mockResolvedValue({});

      const result = await forgotPassword({ email: 'test@ex.com', protocol: 'http', host: 'localhost' });

      expect(sendEmail).toHaveBeenCalled();
      expect(result.sent).toBe(true);
    });
  });

  describe('registerStart', () => {
    test('returns success: true if user already verified (no enumeration)', async () => {
      User.findOne.mockResolvedValue({ isVerified: true });
      const result = await registerStart({ email: 'test@ex.com', password: 'longpassword' });
      expect(result.success).toBe(true);
      expect(User.create).not.toHaveBeenCalled();
    });

    test('creates unverified user and sends code', async () => {
      User.findOne.mockResolvedValue(null);
      const userMock = {
        email: 'test@ex.com',
        getVerifyEmailToken: jest.fn().mockReturnValue('123456'),
        save: jest.fn().mockResolvedValue(true),
      };
      User.create.mockResolvedValue(userMock);

      const result = await registerStart({ email: 'test@ex.com', password: 'longpassword', name: 'Test' });

      expect(User.create).toHaveBeenCalled();
      expect(sendEmail).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('123456') }));
      expect(result.success).toBe(true);
    });
  });

  describe('registerVerify', () => {
    test('verifies user with correct code', async () => {
      const userMock = {
        isVerified: false,
        verifyEmailToken: require('crypto').createHash('sha256').update('123456').digest('hex'),
        verifyEmailExpire: Date.now() + 10000,
        save: jest.fn().mockResolvedValue(true),
        getSignedJwtToken: jest.fn().mockReturnValue('mock-token'),
      };
      User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(userMock) });

      const result = await registerVerify({ email: 'test@ex.com', code: '123456' });

      expect(userMock.isVerified).toBe(true);
      expect(result.token).toBe('mock-token');
    });

    test('throws 400 for invalid code', async () => {
      const userMock = {
        isVerified: false,
        verifyEmailToken: 'different-hash',
        save: jest.fn().mockResolvedValue(true),
      };
      User.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(userMock) });

      await expect(registerVerify({ email: 'test@ex.com', code: 'wrong' })).rejects.toThrow('Invalid or expired verification code');
    });
  });
});
