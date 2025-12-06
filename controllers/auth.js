// auth is logging in, registering, etc. distinct from admin tasks of managing users.

const ErrorResponse = require('../utils/errorResponse');
const asyncHandler = require('../middleware/async');
const User = require('../models/User');

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

    sendTokenResponse(user, 200, res);
})

// get token from model, create cookie with jwt, send response
const sendTokenResponse = (user, statusCode, res) => {
    // create token - LOWERCASE user because this is a static method from our mongoose model
    const token = user.getSignedJwtToken();
    const options = {
        expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000),
        httpOnly: true
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

// @desc    Get current logged in user
// @route   POST /api/v1/auth/me
// @access  Private
exports.getMe = asyncHandler(async (req, res, next) => {
   const user = await User.findById(req.user.id);

   res.status(200).json({
       success: true,
       data: user
   });

});