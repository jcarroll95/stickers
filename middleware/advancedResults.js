// const Stickerboard = require("../models/Stickerboard");
const advancedResults = (model, populate) => async (req, res, next) => {

    let query;  // just initialize

    // Spread operator to copy query element of req into a new object
    const reqQuery = { ...req.query };

    // Array of Fields to exclude when filtering
    const removeFields = ['select', 'sort', 'page', 'limit', 'search'];

    // Loop over removeFields and delete them from reqQuery so we aren't searching the DB for 'select'
    removeFields.forEach(param => delete reqQuery[param]);

    // Handle search if present
    let filter = JSON.parse(JSON.stringify(reqQuery));
    if (req.query.search) {
        const searchRegex = { $regex: req.query.search, $options: 'i' };
        filter.$or = [
            { name: searchRegex },
            { email: searchRegex }
        ];
    }

    // Create query string against the SANITIZED version of reqQuery so we don't re-insert the removed fields
    let queryStr = JSON.stringify(filter);

    // regex goes between //s, \b word boundary, /g global
    // Create comparison operators we can pass to mongoose
    queryStr = queryStr.replace(/\b(gt|gte|lt|lte|in|ne)\b/g, match => `$${match}`);
    console.log(queryStr);

    // Find the resource now that queryStr has been massaged to work for the mongoose method
    query = model.find(JSON.parse(queryStr));

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
    const total = await model.countDocuments(JSON.parse(queryStr));
    const totalPages = Math.ceil(total / limit);

    // mongoose .skip() means skips this number of results before returning results
    // .limit() means restrict the number of documents returned by this query
    query = query.skip(startIndex).limit(limit);

    if (populate) {
        query = query.populate(populate);
    }

    // Execute the query
    const results = await query;

    // Pagination result object
    const pagination = {
        total,
        totalPages
    }

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

    res.advancedResults = {
        success: true,
        count: results.length,
        pagination,
        data: results
    }

    next();
}

module.exports = advancedResults;