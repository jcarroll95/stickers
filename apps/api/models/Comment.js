const mongoose = require('mongoose');
// comments structure will be used to place motivational comments under stickerboards, not stix which already have comments
const CommentSchema = new mongoose.Schema({
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
    commentRating: {
        type: Number,
        enum: [1,2,3,4,5]
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
CommentSchema.statics.getAverageRating = async function(belongsToBoard) {
    // Aggregate average ratings for all comments that belong to this board
    const aggObj = await this.aggregate([
        { $match: { belongsToBoard: belongsToBoard } },
        {
            $group: {
                _id: '$belongsToBoard',
                averageRating: { $avg: '$commentRating' }
            }
        }
    ]);

    // Update the Stickerboard with the new average (or 0 if no stix remain)
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

// Call getAverageRating after save
CommentSchema.post('save', function() {
    this.constructor.getAverageRating(this.belongsToBoard);
});

// Recalculate on deletion of a Comment document
CommentSchema.post('deleteOne', { document: true, query: false }, function() {
    this.constructor.getAverageRating(this.belongsToBoard);
});

// set it so that a given user can only add one comment per board
CommentSchema.index({ belongsToBoard: 1, belongsToUser: 1 }, { unique: true });

module.exports = mongoose.model('Comment', CommentSchema);

