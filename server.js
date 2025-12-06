// @desc Main application file for the server
const path = require('path');
const express = require('express');
// dotenv is possibly not necessary with current node
const dotenv = require('dotenv');
const logger = require('./middleware/logger');
const morgan = require('morgan');
const connectDB = require('./config/db');
const fileupload = require('express-fileupload');
const cookieParser = require('cookie-parser');
const colors = require('colors');

// load environmental vars for dotenv
// the path is passed as an object
dotenv.config({ path: './config/config.env' });

// Connect to MongoDB
connectDB();

// route files
const stickerboard = require('./routes/stickerboard');
const stick = require('./routes/stix');
const auth = require('./routes/auth');
const app = express();

// Body parser middleware which lets our methods access json data in req.body
app.use(express.json());

// Dev logging middleware for morgan
if(process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

// Cookie parser middleware
app.use(cookieParser());

// invoke our custom middleware with app.use
// app.use(logger);

// file upload for express
app.use(fileupload());

// mount routers
app.use('/api/v1/stickerboards', stickerboard); // connecting our route to the file
app.use('/api/v1/stix', stick);
app.use('/api/v1/auth', auth);

// set static folder
app.use(express.static(path.join(__dirname, 'public')));

// Bring in the error wrapper
const errorHandler = require('./middleware/error');
app.use(errorHandler);

// Query Parsing setting for Express to let query work in nested functions
app.set('query parser', 'extended');

// set port to config.env value or 5000 if not present
const PORT = process.env.PORT || 5000;

// We'll put app.listen into a variable so we can listen for unhandled promise rejections
const server = app.listen(
    PORT,
    () => console.log(`Server running in ${process.env.NODE_ENV} mode on port ${PORT}`)
);

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    console.log(`Error (unhandledRejection): ${err.message}`.underline.red.bold);
    // close server and exit process if this happens so app doesn't stay running
    server.close(() => process.exit(1));
});

module.exports = app;