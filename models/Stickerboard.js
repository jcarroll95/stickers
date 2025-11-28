// /models/Stickerboard.js
// This is a schema for a single stickerboard
const mongoose = require('mongoose');

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
    photo: {
        type: String,
        default: 'no-photo.jpg'
    }
});

module.exports = mongoose.model('Stickerboard', StickerboardSchema);