const mongoose = require('mongoose');


// reviews structure will be used to place comments under stickerboards, not stix which already have comments
// belongsToBoard
// belongsToUser
// createdAt
// 1-5 rating of review
// the comment in the review
const ReviewSchema = new mongoose.Schema({
    belongsToBoard: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Stickerboard',
        required: true
    },
    belongsToUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    reviewRating: {
        type: Number,
        Enum: [1,2,3,4,5]
    },
    comment: {
        type: String,
        required: [true, 'Please include a comment'],
        maxlength: [500, 'Max description length is 500 characters']
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
});

module.exports = mongoose.model('Review', ReviewSchema);

