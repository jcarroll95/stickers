// This will handle our mongoose errors. you can log the err object to the console to see all the seed-data fields contained
// inside the error and establish, eg, what name is associated with the specific error so you can test for that name
// and handle it appropriately.

const ErrorResponse = require('../utils/errorResponse');
const errorHandler = (err, req, res, next) => {
// log it for the developer
    console.log(err);
    let error = { ...err } // create a copy of the error with spread operator
    error.message = err.message;

// Mongoose bad ObjectId
    if(err.name === 'CastError' || (err.message && err.message.includes('not found with id of'))) {
        const message = err.name === 'CastError'
            ? `Resource not found: ${err.path}=${err.value}`
            : 'Resource not found';
        error = new ErrorResponse(message, 404);
    }

// Mongoose duplicate key error
    if(err.code === 11000) {
        let message = 'Duplicate field value entered';
        if (err.keyValue && (err.keyValue.belongsToBoard || err.keyValue.belongsToUser)) {
            message = 'Already commented on this board!';
        }
        error = new ErrorResponse(message, 400);
    }

// Mongoose validation error
    if (err.name === 'ValidationError') {
        const messages = Object.values(err.errors).map(v => v.message);
        error = new ErrorResponse(messages.join(', '), 400);
    }

// look for the statusCode attached to our ErrorResponse class
    res.status(error.statusCode || 500).json({
        success: false,
        error: error.message || 'Server Error'
    });
}

module.exports = errorHandler;
