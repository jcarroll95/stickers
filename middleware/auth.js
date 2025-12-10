const jwt = require('jsonwebtoken');
const asyncHandler = require('./async');
const ErrorResponse = require('../utils/errorResponse');
const User = require('../models/User');

// protect routes. this middleware will check for a valid jwt in the request header and attach the decoded user to req.user
// if we require protect and pass it into the function calls, it gives us access to req.user in the controller.
exports.protect = asyncHandler(async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];    // drop the Bearer prefix
    } else if (req.cookies.token) {
        token = req.cookies.token;
    } else if (req.cookies.token) {
      token = req.cookies.token;
    }

    // confirm we actually have a token
    if (!token) {
        return next(new ErrorResponse('Not authorized to access this route', 401));
    }

    try {
        // verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log(decoded);
        // get the decoded id from the token and find that user in the db
        req.user = await User.findById(decoded.id);

        next();
    } catch (err) {
        return next(new ErrorResponse('Not authorized to access this route', 401));
    }
});

// grant access to roles by checking if the user's role is in the list of roles passed in'
exports.authorize = (...roles) => {
    return (req, res, next) => {
        if (!roles.includes(req.user.role)) {
            return next(new ErrorResponse(`User role ${req.user.role} is not authorized to access this route`, 403));
        }
        next();
    }
}