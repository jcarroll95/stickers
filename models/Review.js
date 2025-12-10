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

// Calculate average comment rating
ReviewSchema.statics.getAverageRating = async function(belongsToBoard) {
    // Aggregate average ratings for all comments that belong to this board
    const aggObj = await this.aggregate([
        { $match: { belongsToBoard: belongsToBoard } },
        {
            $group: {
                _id: '$belongsToBoard',
                averageRating: { $avg: '$reviewRating' }
            }
        }
    ]);

    // Update the Stickerboard with the new average (or 0 if no sticks remain)
    try {
        const avg = aggObj.length > 0 ? aggObj[0].averageRating : 0;
        await this.model('Stickerboard').findByIdAndUpdate(
            belongsToBoard,
            { averageRating: avg },
            { new: true, runValidators: false }
        );
    } catch (err) {
        console.error('Error updating Stickerboard averageRating:', err);
    }
}


// Call getAverageCost after save
ReviewSchema.post('save', function() {
    this.constructor.getAverageRating(this.belongsToBoard);
});

// Recalculate on deletion of a Stick document
ReviewSchema.post('deleteOne', { document: true, query: false }, function() {
    this.constructor.getAverageRating(this.belongsToBoard);
});


// set it so that a given user can only add one comment per board - this is probably not what we want
// but it's a good exercise
ReviewSchema.index({ belongsToBoard: 1, user: 1 }, { unique: true });

module.exports = mongoose.model('Review', ReviewSchema);

