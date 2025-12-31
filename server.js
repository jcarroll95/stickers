// @desc Main application file for the server
const path = require('path');
const express = require('express');
// dotenv should be removed in future version due to current node.js capabilities
const dotenv = require('dotenv');
// logger middleware has been deprecated for v1.0.0
// const logger = require('./middleware/logger');
const morgan = require('morgan');
const connectDB = require('./config/db');
const fileupload = require('express-fileupload');
const cookieParser = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');
const colors = require('colors');
const helmet = require('helmet');
const { xss } = require('express-xss-sanitizer');
const bodyParser = require('body-parser');
const rateLimit = require('express-rate-limit');
const hpp = require('hpp');
const cors = require('cors');

// load environmental vars for dotenv
dotenv.config({ path: './config/config.env' });

// Connect to MongoDB (skip when running tests; tests manage their own in-memory DB connection)
if (process.env.NODE_ENV !== 'test') {
    connectDB();
}

// route files
const stickerboard = require('./routes/stickerboard');
const stick = require('./routes/stix');
const auth = require('./routes/auth');
const users = require('./routes/users');
const reviews = require('./routes/reviews');
const admin = require('./routes/admin');
const { performanceMiddleware } = require('./middleware/performance');

// define express app
const app = express();

// Use performance middleware early to track all requests
app.use(performanceMiddleware);

// Body parser middleware which lets our methods access json data in req.body
// original body parser no longer needed
app.use(express.json());



// Dev logging middleware for morgan
if(process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// express xss clean middleware
app.use(bodyParser.json({limit:'1kb'}));
app.use(bodyParser.urlencoded({extended: true, limit:'1kb'}));
app.use(xss());

// If behind NGINX (reverse proxy), make Express respect X-Forwarded-For
app.set('trust proxy', 1);

// rate limiting
const limiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 mins
    max: 100
});
app.use(limiter);

// prevent http param pollution
app.use(hpp());

// enable cors
app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true
}));

// Cookie parser middleware
app.use(cookieParser());

// deprecated logger middleware
// app.use(logger);

// file upload for express
app.use(fileupload());

// mount routers
app.use('/api/v1/stickerboards', stickerboard); // connecting our route to the file
app.use('/api/v1/stix', stick);
app.use('/api/v1/auth', auth);
app.use('/api/v1/auth/users', users);
app.use('/api/v1/reviews', reviews)
app.use('/api/v1/admin', admin);

// helmet
app.use(helmet());

// sanitize data (Express 5 has a getter-only req.query; use manual sanitizer to avoid reassigning req.query)
app.use((req, res, next) => {
    const opts = { allowDots: true };
    if (req.body) mongoSanitize.sanitize(req.body, opts);
    if (req.params) mongoSanitize.sanitize(req.params, opts);
    if (req.headers) mongoSanitize.sanitize(req.headers, opts);
    if (req.query) mongoSanitize.sanitize(req.query, opts); // mutate in place, do not reassign
    next();
});

// set static folder
app.use(express.static(path.join(__dirname, 'public')));

// Bring in the error wrapper
const errorHandler = require('./middleware/error');
app.use(errorHandler);

// Query Parsing setting for Express to let query work in nested functions
app.set('query parser', 'extended');

// set port to config.env value or 5000 if not present
const PORT = process.env.PORT || 5000;

// Only start the HTTP listener when this file is executed directly (not when required by tests)
let server;
if (require.main === module) {
    // We'll put app.listen into a variable so we can listen for unhandled promise rejections
    server = app.listen(
        PORT,
        () => console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`)
    );

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err) => {
        console.log(`Error (unhandledRejection): ${err.message}`.underline.red.bold);
        // close server and exit process if this happens so app doesn't stay running
        server.close(() => process.exit(1));
    });
}

module.exports = app;