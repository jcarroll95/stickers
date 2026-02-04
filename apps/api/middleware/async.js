// all of our controller functions will have the arrow function wrapped in this asyncHandler
// This function receives a function and returns a function with 3 input parameters. This new function is responsible
// to execute the original function, pass the 3 params, and catch any errors.
const asyncHandler = fn => (req, res, next) =>
    Promise
        .resolve(fn(req, res, next))
        .catch(next);

module.exports = asyncHandler;