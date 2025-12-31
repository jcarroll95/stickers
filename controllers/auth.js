// auth is logging in, registering, etc. distinct from admin tasks of managing users.
const crypto = require('crypto');
const sendEmail = require('../utils/sendEmail');
const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const User = require('../models/User');

// Helper: basic email normalization
function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

// Helper: minimal validators (keep deps minimal)
function assertValidEmailAndPassword(email, password) {
  const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,})+$/;
  if (!email || !emailRegex.test(email)) {
    throw new ErrorResponse('Please provide a valid email address', 400);
  }
  if (!password || String(password).length < 6) {
    throw new ErrorResponse('Password must be at least 6 characters', 400);
  }
}

// @desc    Register User
// @route   POST /api/v1/auth/register
// @access  Public
exports.register = asyncHandler(async (req, res, next) => {

    const { name, email, password, role } = req.body;

    // create user
    const user = await User.create({
        name,
        email,
        password,
        role
    });

    // create token - LOWERCASE user because this is a static method from our mongoose model
    const token = user.getSignedJwtToken();

    res.status(200).json({ success: true, token });
})

// @desc    Login User
// @route   POST /api/v1/auth/login
// @access  Public
exports.login = asyncHandler(async (req, res, next) => {

    const { email, password } = req.body;

    // validate email and password entered. we don't have the model to validate for us like above.
    if (!email || !password) {
        return next(new ErrorResponse('Please provide an email and password', 400));
    }

    // check if user exists. .select to override model's default to not return password
    // upper cased User for findOne
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
        return next(new ErrorResponse('Invalid credentials', 401));
    }

    // check if password matches
    const isMatch = await user.matchPassword(password);

    if (!isMatch) {
        return next(new ErrorResponse('Invalid credentials', 401));
    }

    // If email not verified, block login
    if (!user.isVerified) {
        return next(new ErrorResponse('Please verify your email address before logging in.', 403));
    }

    sendTokenResponse(user, 200, res);
})

// @desc    Logout current logged in user and clear cookie
// @route   GET /api/v1/auth/logout
// @access  Private
exports.logout = asyncHandler(async (req, res, next) => {
    res.cookie('token', 'none', {expires: new Date(Date.now() + 10 * 1000), httpOnly: true});

    res.status(200).json({
        success: true,
        data: {}
    });

});

// @desc    Get current logged in user
// @route   GET /api/v1/auth/me
// @access  Private
exports.getMe = asyncHandler(async (req, res, next) => {
   const user = await User.findById(req.user.id);

   res.status(200).json({
       success: true,
       data: user
   });

});

// @desc    Forgot Password
// @route   POST /api/v1/auth/forgotpassword
// @access  Public
exports.forgotPassword = asyncHandler(async (req, res, next) => {
    const user = await User.findOne({ email: req.body.email });

    if (!user) {
        return next(new ErrorResponse('Email not recognized', 404));
    }

    // Get reset token
    const resetToken = user.getResetPasswordToken();

    // save the reset token
    await user.save({ validateBeforeSave: false });

    // create reset password url with token
    const resetUrl = `${req.protocol}://${req.get('host')}/api/v1/auth/resetpassword/${resetToken}`;
    const message = `You are receiving this email because you (or someone else) have requested the reset of a password. Please make a PUT request to: \n\n ${resetUrl}`;

    try {
        await sendEmail({
            email: user.email,
            subject: 'Password Reset Token',
            message
        });

        // if it works:
        res.status(200).json({ success: true, data: 'Password reset email sent' });
  } catch (err) {
        // sendEmail failed, we need to remove the reset token from the user's record'
        console.log(err);
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;

        await user.save({ validateBeforeSave: false });

        return next(new ErrorResponse('Email could not be sent', 500));
    }

});

// @desc    Reset Password
// @route   PUT /api/v1/auth/resetpassword/:resettoken
// @access  Private
exports.resetPassword = asyncHandler(async (req, res, next) => {
    // get hashed token
    const resetPasswordToken = crypto.createHash('sha256')
        .update(req.params.resettoken)
        .digest('hex');

    // find if user exists with this token and if it's not expired'
    const user = await User.findOne({
        resetPasswordToken,
        resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
        return next(new ErrorResponse('Invalid token', 400));
    }

    // set new password, encrypted by our model User.Schema.pre('save') checking if pw was modified
    user.password = req.body.password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    // send success response and logged in token
    sendTokenResponse(user, 200, res);
});

// get token from model, create cookie with jwt, send response
const sendTokenResponse = (user, statusCode, res) => {
    // create token - LOWERCASE user because this is a static method from our mongoose model
    const token = user.getSignedJwtToken();
    const options = {
        expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000),
        httpOnly: true,
        sameSite: 'lax'
    }

    // if in production then use https for cookie
    if (process.env.NODE_ENV === 'production') {
        options.secure = true;
    }

    res
        .status(statusCode)
        .cookie('token', token, options)
        .json({
            success: true,
            token
        });
}

// =======================
// Email verification flow
// =======================

// @desc    Start registration (send verification code)
// @route   POST /api/v1/auth/register-start
// @access  Public
exports.registerStart = asyncHandler(async (req, res, next) => {
  const email = normalizeEmail(req.body.email);
  const password = req.body.password;
  const name = (req.body.name || '').toString().trim() || 'New User';

  assertValidEmailAndPassword(email, password);

  let user = await User.findOne({ email });

  // If user exists and is verified, respond with generic success to avoid enumeration
  if (user && user.isVerified) {
    return res.status(200).json({ success: true });
  }

  // Create pending user if not exists
  if (!user) {
    user = await User.create({ name, email, password, isVerified: false });
  } else {
    // User exists but unverified: update password if provided (optional), but do not fail
    if (password) user.password = password; // will be hashed on save
  }

  // Cooldown: avoid spamming email sends (60s)
  const now = Date.now();
  const lastSent = user.lastVerificationSentAt ? user.lastVerificationSentAt.getTime() : 0;
  if (lastSent && now - lastSent < 60 * 1000) {
    // Silently accept without resending to prevent abuse
    return res.status(200).json({ success: true });
  }

  const code = user.getVerifyEmailToken(); // sets token+expiry+timestamps
  await user.save({ validateBeforeSave: false });

  const message = `Your verification code is ${code}. It expires in 15 minutes.`;
  await sendEmail({ email: user.email, subject: 'Your verification code', message });

  return res.status(200).json({ success: true });
});

// @desc    Verify email with code and complete registration
// @route   POST /api/v1/auth/register-verify
// @access  Public
exports.registerVerify = asyncHandler(async (req, res, next) => {
  const email = normalizeEmail(req.body.email);
  const code = String(req.body.code || '');

  if (!email || !code) {
    return next(new ErrorResponse('Email and code are required', 400));
  }

  const user = await User.findOne({ email }).select('+password');
  if (!user || user.isVerified) {
    return next(new ErrorResponse('Invalid or expired verification code', 400));
  }

  // Lockout after too many attempts
  const attempts = user.verifyEmailAttempts || 0;
  if (attempts >= 5) {
    return next(new ErrorResponse('Too many incorrect attempts. Please request a new code later.', 429));
  }

  const hashed = crypto.createHash('sha256').update(code).digest('hex');
  if (!user.verifyEmailToken || user.verifyEmailToken !== hashed || !user.verifyEmailExpire || Date.now() > user.verifyEmailExpire) {
    user.verifyEmailAttempts = attempts + 1;
    await user.save({ validateBeforeSave: false });
    return next(new ErrorResponse('Invalid or expired verification code', 400));
  }

  // Success: verify account
  user.isVerified = true;
  user.verifyEmailToken = undefined;
  user.verifyEmailExpire = undefined;
  user.verifyEmailAttempts = 0;
  await user.save();

  // Issue JWT like login
  sendTokenResponse(user, 200, res);
});

// @desc    Resend verification code
// @route   POST /api/v1/auth/register-resend
// @access  Public
exports.registerResend = asyncHandler(async (req, res, next) => {
  const email = normalizeEmail(req.body.email);
  if (!email) return next(new ErrorResponse('Email is required', 400));

  const user = await User.findOne({ email });
  if (!user || user.isVerified) {
    // Do not enumerate
    return res.status(200).json({ success: true });
  }

  // Respect cooldown of 60s
  const now = Date.now();
  const lastSent = user.lastVerificationSentAt ? user.lastVerificationSentAt.getTime() : 0;
  if (lastSent && now - lastSent < 60 * 1000) {
    return res.status(200).json({ success: true });
  }

  const code = user.getVerifyEmailToken();
  await user.save({ validateBeforeSave: false });

  const message = `Your verification code is ${code}. It expires in 15 minutes.`;
  await sendEmail({ email: user.email, subject: 'Your verification code', message });

  return res.status(200).json({ success: true });
});

// @desc    Update user details
// @route   PUT /api/v1/auth/updatedetails
// @access  Private
exports.updateDetails = asyncHandler(async (req, res, next) => {
    // this is just for name and email updates: therefore do not apply req.body to the  model, because someone
    // could inject other fields like changing their role
    const fieldsToUpdate = {
        email: req.body.email,
        name: req.body.name
    }
    const user = await User.findByIdAndUpdate(req.user.id, fieldsToUpdate, {
        new: true,
        runValidators: true
    });

    res.status(200).json({
        success: true,
        data: user
    });

});

// @desc    Update Password
// @route   PUT /api/v1/auth/updatepassword
// @access  Private
exports.updatePassword = asyncHandler(async (req, res, next) => {
    // we are going to find the user by the logged in id AND add in comparison to the stored password which is
    // not selected by default in our model
    const user = await User.findById(req.user.id).select('+password');

    // check password
    if (!(await user.matchPassword(req.body.currentPassword))) {
        return next(new ErrorResponse('Invalid password', 401));
    }
    // update password and save to db
    user.password = req.body.newPassword;
    await user.save();

    // send successful respone with updated token for new pw
    sendTokenResponse(user, 200, res);

});

