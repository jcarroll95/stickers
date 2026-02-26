const jwt = require('jsonwebtoken');
const asyncHandler = require('./async');
const ErrorResponse = require('../utils/errorResponse');
const User = require('../models/User');
const redisClient = require('../config/redis');

exports.protect = asyncHandler(async (req, res, next) => {
    let token;

    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
        token = req.headers.authorization.split(' ')[1];    // drop the Bearer prefix
    } else if (req.cookies.token) {
        token = req.cookies.token;
    }

    if (!token) {
        return next(new ErrorResponse('Not authorized to access this route', 401));
    }

    try {
        if (redisClient.isOpen) {
          const isRevoked = await redisClient.get(`blacklist:${token}`);

          if (isRevoked) {
            return next(new ErrorResponse('Not authorized to access this route', 401));
          }
        }
        // verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // New logic for stateless RBAC reducing db hits
        req.user = {
          id: decoded.id,
          _id: decoded.id,  // For Mongoose compatibility / Audit logs
          role: decoded.role // For RBAC
        };
        // old logic, deprecated by above
        // req.user = await User.findById(decoded.id);
        if (!req.user) return next(new ErrorResponse('Not authorized to access this route', 401));
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
