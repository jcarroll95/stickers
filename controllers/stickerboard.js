// Stickerboard controllers
const path = require('path');
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

    // Array of Fields to exclude when filtering
    // select chooses to return a limited selection of fields from the query
    // sort chooses sortby field and establishes a default
    // page and limit are for pagination. limit = results per page
    const removeFields = ['select', 'sort', 'page', 'limit'];

    // Loop over removeFields and delete them from reqQuery so we aren't searching the DB for 'select'
    removeFields.forEach(param => delete reqQuery[param]);

    // Create query string against the SANITIZED version of reqQuery so we don't re-insert the removed fields
    let queryStr = JSON.stringify(reqQuery);

    // regex goes between //s, \b word boundary, /g global
    // Create comparison operators we can pass to mongoose
    queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in)\b/g, match => `$${match}`);
    console.log(queryStr);

    // Find the resource now that queryStr has been massaged to work for the mongoose method
    query = Stickerboard.find(JSON.parse(queryStr)).populate('stix');

    // Sort the query with default by created date descending
    if (req.query.sort) {
        const sortBy = req.query.sort.split(',').join(' ');
        query = query.sort(sortBy);
    } else {
        query = query.sort('-createdAt');   // -1 is mongoose for descending
    }

    // Select fields if select was included in the query
    if (req.query.select) {
        // Selected fields are comma delimited in our request, but Mongoose wants them space delimited
        // .split turns them into an array, join rejoins them space delimited
        const fields = req.query.select.split(',').join(' ');
        query = query.select(fields);
        console.log(`Selected these fields: ${fields}`.yellow.underline);
    }

    // Pagination stuff
    const page = parseInt(req.query.page, 10) || 1;       // requested page, default 1
    const limit = parseInt(req.query.limit, 10) || 20;    // requested perpage, default 20
    const startIndex = (page - 1) * limit;                      // which result to start listing on this page
    const endIndex = page * limit;                              // last result
    const total = await Stickerboard.countDocuments(JSON.parse(queryStr));

    // mongoose .skip() means skips this number of results before returning results
    // .limit() means restrict the number of documents returned by this query
    query = query.skip(startIndex).limit(limit);

    // Execute the query
    const stickerboards = await query;

    // Pagination result object
    const pagination = {}

    if (endIndex < total) {
        pagination.next = {
            page: page + 1,
            limit
        }
    }

    if (startIndex > 0) {
        pagination.prev = {
            page: page - 1,
            limit
        }
    }


    // Publish the response
    res
        .status(200)
        .json(res.advancedResults);
});

// @desc Get single stickerboard
// @route GET /api/v1/stickerboards/:id
// @access Public
exports.getStickerboard = asyncHandler(async (req, res, next) => {
        const stickerboard = await Stickerboard.findById(req.params.id);

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

        res.status(200).json({ success: true, data: stickerboard });
});


// @desc      Create new stickerboard
// @route     POST /api/v1/stickerboards
// @access    Private
exports.createStickerboard = asyncHandler(async (req, res, next) => {
    // Add user to req.body
    req.body.user = req.user.id;
    console.log(req.body);

    // Check if this user already has a published stickerboard
    const publishedStickerboard = await Stickerboard.findOne({ user: req.user.id });

    // if user is not a vip they can only have one published stickerboard
    if (publishedStickerboard && req.user.role !== 'vipuser') {
        return next(new ErrorResponse(`The user with ID ${req.user.id} has already published a Stickerboard`, 400));
    }

    const stickerboard = await Stickerboard.create(req.body);
    res.status(201).json({
        success: true,
        data: stickerboard
    });

});

// @desc Update stickerboard
// @route PUT /api/v1/stickerboards/:id
// @access Private
exports.updateStickerboard = asyncHandler(async (req, res, next) => {

    // The mongoose method findByIdAndUpdate will take the id parameter from the route, and apply JSON data contained
    // in the body against matching fields in the schema, with the defined validation.
        let stickerboard = await Stickerboard.findById(req.params.id);

        if (!stickerboard) {
            return next(
                new ErrorResponse(`Stickerboard not found with id of ${req.params.id}`, 404)
            );
        }

        // make sure this user owns the stickerboard
        if (stickerboard.user.toString() !== req.user.id && req.user.role !== 'admin') {
            return next(
                new ErrorResponse(`User ${req.user.id} is not authorized to update this board`, 401)
            )
        }

        // in this instance .findOneAndUpdate is requiring an OBJECT as the filter param { _id: req.params.id }
        // rather than simply passing in req.params.id and I don't know why it works everywhere else but not here.
        stickerboard = await Stickerboard.findOneAndUpdate({ _id: req.params.id }, req.body, {
            new: true,
            runValidators: true
        });


        res.status(200).json({ success: true, data: stickerboard });
});

// @desc Delete stickerboard
// @route DELETE /api/v1/stickerboards/:id
// @acess Private
exports.deleteStickerboard = asyncHandler(async (req, res, next) => {
        const stickerboard = await Stickerboard.findById(req.params.id);

        if (!stickerboard) {
            return next(
                new ErrorResponse(`Stickerboard not found with id of ${req.params.id}`, 404)
            );
        }
        //await Stick.deleteMany({ belongsToBoard: req.params.id });

        // make sure this user owns the stickerboard
        if (stickerboard.user.toString() !== req.user.id && req.user.role !== 'admin') {
            return next(
                new ErrorResponse(`User ${req.user.id} is not authorized to delete this board`, 401)
            )
        }

        await stickerboard.deleteOne();

        // if the delete is successful we'll return an empty object {}
        res.status(200).json({ success: true, data: {} });
});

// @desc Upload photo for stickerboard
// @route PUT /api/v1/stickerboards/:id/photo
// @acess Private
exports.stickerboardPhotoUpload= asyncHandler(async (req, res, next) => {
    const stickerboard = await Stickerboard.findById(req.params.id);

    if (!stickerboard) {
        return next(
            new ErrorResponse(`Stickerboard not found with id of ${req.params.id}`, 404)
        );
    }

    // make sure this user owns the stickerboard
    if (stickerboard.user.toString() !== req.user.id && req.user.role !== 'admin') {
        return next(
            new ErrorResponse(`User ${req.user.id} is not authorized to delete this board`, 401)
        )
    }

    if (!req.files) {
        return next(
            new ErrorResponse(`Please upload a file`, 400)
        );
    }

    const file = req.files.file;
    console.log(file);
    // check that we got a photo
    if (!file.mimetype.startsWith('image')) {
        return next(new ErrorResponse(`Please upload an image`, 400));
    }

    // check filesize
    if (file.size > process.env.MAX_FILE_UPLOAD) {
        return next(
            new ErrorResponse(`Please upload an image smaller than ${process.env.MAX_FILE_UPLOAD} bytes`, 400)
        );
    }

    // create filename
    file.name = `photo_${stickerboard._id}${path.parse(file.name).ext}`;
    console.log(file.name);

    // write the file
    file.mv(`${process.env.FILE_UPLOAD_PATH}/${file.name}`, async err => {

        if (err) {
            console.error(err);
            return next(
                new ErrorResponse(`Problem with file upload`, 500)
            );
        }

        await Stickerboard.findByIdAndUpdate(req.params.id, { photo: file.name });
        res.status(200).json({
            success: true,
            data: file.name
        });
    });

});