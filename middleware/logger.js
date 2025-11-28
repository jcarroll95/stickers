// WE'LL ACTUALLY INSTALL 'MORGAN' FOR MIDDLEWARE LOGGING


// logging middleware
// @desc Logs request to console.
const logger = (req, res, next) => {
    req.hello = 'Hello World'; // a variable on the request object we create and can access in our routes
    console.log(`${req.method} ${req.protocol}://${req.get('host')}${req.originalUrl}`);
    next(); // we call this in all middleware so it knows to move on to the next
}

module.exports = logger;
