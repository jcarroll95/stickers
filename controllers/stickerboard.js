// Stickerboard controllers
const ErrorResponse = require('../utils/errorResponse');
const Stickerboard = require('../models/Stickerboard');
const asyncHandler = require('../middleware/async');




// @desc Get all stickerboards
// @route GET /api/v1/stickerboards
// @access Public
exports.getStickerboards = asyncHandler(async (req, res, next) => {
        // await on the async call to .find() for find all stickerboards, and return success
        // console.log(req.query)
        // const stickerboards = await Stickerboard.find();
        // we'll modify the basic routine above to use a regex to make the query conform
        // to the MONGODB query operators standards for > < >= <=

        let query;  // just initialize

        // Spread operator to copy query element of req into a new object
        const reqQuery = { ...req.query };

        // Array of Fields to exclude when filtering, just our keyword 'select' for now
        const removeFields = ['select'];

        // Loop over removeFields and delete them from reqQuery so we aren't searching the DB for 'select'
        removeFields.forEach(param => delete reqQuery[param]);

        // Create query string
        let queryStr = JSON.stringify(req.query);

        // regex goes between //s, \b word boundary, /g global
        // Create comparison operators we can pass to mongoose
        queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);
        console.log(queryStr);

        // Find the resource
        query = Stickerboard.find(JSON.parse(queryStr));

        // Select fields if select was included in the query
        if (req.query.select) {
            // Selected fields are comma delimited in our request, but Mongoose wants them space delimited
            // .split turns them into an array, join rejoins them space delimited
            const fields = req.query.select.split(',').join(' ');
            query = query.select(fields);
            console.log(`Selected these fields: ${fields}`.yellow.underline);
        }

        // Execute the query
        const stickerboards = await query;

        // Publish the response
        res
            .status(200)
            .json({ success: true, count: stickerboards.length, data: stickerboards });
});

// @desc Get single stickerboard
// @route GET /api/v1/stickerboards/:id
// @access Public
exports.getStickerboard = asyncHandler(async (req, res, next) => {
        const stickerboard = await Stickerboard.findById(req.params.id);
        res.status(200).json({ success: true, data: stickerboard });
        // since we're looking for a specific ID, it's possible that one doesn't exist
        // if it doesn't exist then stickerboard will be empty
        // we have to RETURN res.status this time since we already set it in the statement
        // above, and we will get an error sending the header twice

        if(!stickerboard) {
            return next(
                new ErrorResponse(`Stickerboard not found with id of ${req.params.id}`, 404)
            );
        }
        // res.status(400).json({ success: false });
        // We'll modify this basic error response to conform to the Express.js guide which says
        // "For errors returned from asynchronous functions invoked by route handlers and middleware,
        // you must pass them the next() function, where Express will catch and process them. If we don't
        // want Express to handle the error (it outputs an HTML page, we want to output JSON data) then you
        // have to create your own error handler function. To do this you must delegate
});


// @desc      Create new stickerboard
// @route     POST /api/v1/stickerboards
// @access    Private
exports.createStickerboard = asyncHandler(async (req, res, next) => {
    // Add user to req,body
    //req.body.user = req.user.id;
    console.log(req.body);
    // Check for published bootcamp
    // const publishedStickerboard = await Stickerboard.findOne({user: req.user.id});
    const publishedStickerboard = false;
    const stickerboard = await Stickerboard.create(req.body);
    res.status(201).json({
        success: true,
        data: stickerboard
    });
    // If the user is not an admin, they can only add one bootcamp
    if (publishedStickerboard && req.user.role !== 'admin') {
        // `The user with ID ${req.user.id} has already published a Stickerboard`,
        return next(
            new ErrorResponse(
                `Oh nooooooo`,
                400
            )
        );
    }
});

// @desc Update stickerboard
// @route PUT /api/v1/stickerbaords/:id
// @access Private
exports.updateStickerboard = asyncHandler(async (req, res, next) => {

    // The mongoose method findByIdAndUpdate will take the id parameter from the route, and apply JSON data contained
    // in the body against matching fields in the schema, with the defined validation.
        const stickerboard = await Stickerboard.findByIdAndUpdate(req.params.id, req.body, {
            new: true,
            runValidators: true
        });

        if (!stickerboard) {
            return next(
                new ErrorResponse(`Stickerboard not found with id of ${req.params.id}`, 404)
            );
        }

        res.status(200).json({ success: true, data: stickerboard });
});

// @desc Delete stickerboard
// @route DELETE /api/v1/stickerboards/:id
// @acess Private
exports.deleteStickerboard = asyncHandler(async (req, res, next) => {
        const stickerboard = await Stickerboard.findByIdAndDelete(req.params.id);

        if (!stickerboard) {
            return next(
                new ErrorResponse(`Stickerboard not found with id of ${req.params.id}`, 404)
            );
        }
        // if the delete is successful we'll return an empty object {}
        res.status(200).json({ success: true, data: {} });
});