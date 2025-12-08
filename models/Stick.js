const mongoose = require('mongoose');

const stickLocations = ['Stomach', 'Arm', 'Thigh', 'Other'];
const stickLocMod = ['Left', 'Right', 'Upper', 'Upper Left', 'Upper Right', 'Lower', 'Lower Left', 'Lower Right'];


const StickSchema = new mongoose.Schema({
    belongsToBoard: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Stickerboard',
        required: true
    },
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    belongsToUser: String,
    stickNumber: Number,
    stickMed: String,
    stickLocation: {
        type: String,
        enum: stickLocations,
        required: [true, 'Please enter a valid stick location']
    },
    stickLocMod: {
        type: String,
        enum: stickLocMod,
        required: [true, 'Please enter a valid stick location']
    },
    stickDose: {
        type: Number,
        required: true,
        default: 2.5
    },
    userTime: Date,
    userDate: Date,
    description: {
        type: String,
        required: [true, 'Please describe this stick'],
        maxlength: [500, 'Max description length is 500 characters']
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    cost: {
        type: Number,
        default: 0
    }
});

// Mongoose: statics are called on the actual model, methods are called on the document
// Stick.myStaticMethod();
// const stix = Stick.find()
// stix.myMethod();
StickSchema.statics.getAverageCost = async function(belongsToBoard) {
    //console.log('Calculating average cost for board: '.blue, belongsToBoard);

    // Aggregate average cost for all sticks that belong to this board
    const aggObj = await this.aggregate([
        { $match: { belongsToBoard: belongsToBoard } },
        {
            $group: {
                _id: '$belongsToBoard',
                averageCost: { $avg: '$cost' }
            }
        }
    ]);

    // Update the Stickerboard with the new average (or 0 if no sticks remain)
    try {
        const avg = aggObj.length > 0 ? aggObj[0].averageCost : 0;
        await this.model('Stickerboard').findByIdAndUpdate(
            belongsToBoard,
            { averageCost: avg },
            { new: true, runValidators: false }
        );
    } catch (err) {
        console.error('Error updating Stickerboard averageCost:', err);
    }
}


// Call getAverageCost after save
StickSchema.post('save', function() {
    this.constructor.getAverageCost(this.belongsToBoard);
});

// Recalculate on deletion of a Stick document
StickSchema.post('deleteOne', { document: true, query: false }, function() {
    this.constructor.getAverageCost(this.belongsToBoard);
});

module.exports = mongoose.model('Stick', StickSchema);

