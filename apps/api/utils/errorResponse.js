// This will be our new error handler so that our API's error handling can
// involve both the error response and an HTTP status code.
class ErrorResponse extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
    }
}

module.exports = ErrorResponse;