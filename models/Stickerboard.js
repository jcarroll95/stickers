// /models/Stickerboard.js
// This is a schema for a single stickerboard
const mongoose = require('mongoose');
const slugify = require('slugify');

const StickerboardSchema = new mongoose.Schema({
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
    totalCost: Number
},
    {
        toJSON: { virtuals: true }
    },
);

// Let's introduce slugify middleware - create a stickerboard slug from the name.
// .pre functions are mongoose middleware run against the db document data before the action is taken in the database
// don't use an arrow function here because we want the scope of the this keyword to apply
// to the document in this request
StickerboardSchema.pre('save', function () {
    this.slug = slugify(this.name, { lower: true });
    console.log('Slugify ran', this.name.yellow.bold);
    // UPDATE: apparently something is not right because next is not being passed into this function
    // and therefore my attempt to call next() results in an error, so we'll take it out for now.

    //next();
});


// Cascade delete courses when a stickerboard is deleted

StickerboardSchema.pre('deleteOne', { document: true, query: false },async function (next) {
    console.log(`Stickerboard ___ deleted, stix associated with id ___ deleted`.red.inverse);
    await this.model('Stick').deleteMany( { belongsToBoard: this._id });
    //next();
});

// Reverse population with virtual fields
StickerboardSchema.virtual('stix', {
    ref: 'Stick',
    localField: '_id',
    foreignField: 'belongsToBoard',
    justOne: false
});

module.exports = mongoose.model('Stickerboard', StickerboardSchema);