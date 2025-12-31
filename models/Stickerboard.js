// This is a schema for a single stickerboard
const mongoose = require('mongoose');
const slugify = require('slugify');

const StickerboardSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: {
        type: String,
        required: [true, 'Please name your stickerboard'],
        unique: true,
        trim: true,
        maxlength: [50, 'Name can not exceed 50 characters'],
    },
    slug: String,
    description: {
        type: String,
        required: [true, 'Please describe your stickerboard'],
        maxlength: [500, 'Description can not exceed 500 characters'],
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    tags: [String],
    photo: {
        type: String,
        default: 'no-photo.jpg'
    },
    totalCost: Number,
    averageRating: Number,
    averageCost: Number,
    backgroundFile: String,      // references a predefined asset
    width: Number,             // logical width (e.g. 1000)
    height: Number,            // logical height (e.g. 700)
    stickers: [
        {
            stickerId: Number,     // predefined asset id
            x: Number,             // normalized or absolute coordinates
            y: Number,
            scale: Number,
            rotation: Number,
            zIndex: Number,
            stuck: Boolean,
            createdAt: Date
        }
    ]
},
    {
        toJSON: { virtuals: true }
    },
);

// create a stickerboard slug from the name.
StickerboardSchema.pre('save', function () {
    this.slug = slugify(this.name, { lower: true });
    console.log('Slugify ran', this.name.yellow.bold);
});

// Cascade delete stix and comments when a stickerboard is deleted
StickerboardSchema.pre('deleteOne', { document: true, query: false },async function (next) {
    console.log(`Stickerboard ${this._id} deleted, stix and comments associated with it deleted`.red.inverse);
    await this.model('Stick').deleteMany( { belongsToBoard: this._id });
    await this.model('Comment').deleteMany( { belongsToBoard: this._id });
});

// Reverse population with virtual fields
StickerboardSchema.virtual('stix', {
    ref: 'Stick',
    localField: '_id',
    foreignField: 'belongsToBoard',
    justOne: false
});

StickerboardSchema.virtual('comments', {
    ref: 'Comment',
    localField: '_id',
    foreignField: 'belongsToBoard',
    justOne: false
});

module.exports = mongoose.models.Stickerboard || mongoose.model('Stickerboard', StickerboardSchema);