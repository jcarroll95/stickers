const asyncHandler = require('../middleware/async');
const ErrorResponse = require('../utils/errorResponse');

const {
  register,
  login,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
  registerStart,
  registerVerify,
  registerResend,
  updateDetails,
  updatePassword,
} = require('../usecases/auth/authUsecases');

/**
 * HTTP helper: set cookie + send token response.
 * This is delivery-layer only (Express).
 */
const sendTokenResponse = (user, token, statusCode, res) => {
  const options = {
    expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000),
    httpOnly: true,
    sameSite: 'lax',
  };

  if (process.env.NODE_ENV === 'production') {
    options.secure = true;
  }

  res
    .status(statusCode)
    .cookie('token', token, options)
    .json({
      success: true,
      token,
      data: user,
    });
};

/**
 * @desc    Register User
 * @route   POST /api/v1/auth/register
 * @access  Public
 */
exports.register = asyncHandler(async (req, res) => {
  const { name, email, password, role } = req.body;

  const { token, user } = await register({
    name,
    email,
    password,
    role,
    nodeEnv: process.env.NODE_ENV,
  });

  // keep old behavior: token in response (no cookie for register)
  res.status(200).json({ success: true, token, data: user });
});

/**
 * @desc    Login User
 * @route   POST /api/v1/auth/login
 * @access  Public
 */
exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const { token, user } = await login({ email, password });

  sendTokenResponse(user, token, 200, res);
});

/**
 * @desc    Logout current logged in user and clear cookie
 * @route   GET /api/v1/auth/logout
 * @access  Private
 */
exports.logout = asyncHandler(async (req, res) => {
  await logout();

  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000),
    httpOnly: true,
  });

  res.status(200).json({ success: true, data: {} });
});

/**
 * @desc    Get current logged in user
 * @route   GET /api/v1/auth/me
 * @access  Private
 */
exports.getMe = asyncHandler(async (req, res) => {
  const { user } = await getMe({ userId: req.user.id });
  res.status(200).json({ success: true, data: user });
});

/**
 * @desc    Forgot Password
 * @route   POST /api/v1/auth/forgotpassword
 * @access  Public
 */
exports.forgotPassword = asyncHandler(async (req, res, next) => {
  const email = req.body.email;
  if (!email) return next(new ErrorResponse('Email is required', 400));

  await forgotPassword({
    email,
    protocol: req.protocol,
    host: req.get('host'),
  });

  res.status(200).json({ success: true, data: 'Password reset email sent' });
});

/**
 * @desc    Reset Password
 * @route   PUT /api/v1/auth/resetpassword/:resettoken
 * @access  Private
 */
exports.resetPassword = asyncHandler(async (req, res) => {
  const { token, user } = await resetPassword({
    resetTokenParam: req.params.resettoken,
    newPassword: req.body.password,
  });

  sendTokenResponse(user, token, 200, res);
});

/**
 * @desc    Start registration (send verification code)
 * @route   POST /api/v1/auth/register-start
 * @access  Public
 */
exports.registerStart = asyncHandler(async (req, res) => {
  await registerStart({
    email: req.body.email,
    password: req.body.password,
    name: req.body.name,
  });

  res.status(200).json({ success: true });
});

/**
 * @desc    Verify email with code and complete registration
 * @route   POST /api/v1/auth/register-verify
 * @access  Public
 */
exports.registerVerify = asyncHandler(async (req, res) => {
  const { token, user } = await registerVerify({
    email: req.body.email,
    code: req.body.code,
    nodeEnv: process.env.NODE_ENV,
  });

  sendTokenResponse(user, token, 200, res);
});

/**
 * @desc    Resend verification code
 * @route   POST /api/v1/auth/register-resend
 * @access  Public
 */
exports.registerResend = asyncHandler(async (req, res) => {
  await registerResend({ email: req.body.email });
  res.status(200).json({ success: true });
});

/**
 * @desc    Update user details
 * @route   PUT /api/v1/auth/updatedetails
 * @access  Private
 */
exports.updateDetails = asyncHandler(async (req, res) => {
  const { user } = await updateDetails({
    userId: req.user.id,
    email: req.body.email,
    name: req.body.name,
  });

  res.status(200).json({ success: true, data: user });
});

/**
 * @desc    Update Password
 * @route   PUT /api/v1/auth/updatepassword
 * @access  Private
 */
exports.updatePassword = asyncHandler(async (req, res) => {
  const { token, user } = await updatePassword({
    userId: req.user.id,
    currentPassword: req.body.currentPassword,
    newPassword: req.body.newPassword,
  });

  sendTokenResponse(user, token, 200, res);
});
