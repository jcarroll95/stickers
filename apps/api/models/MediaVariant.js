const mongoose = require('mongoose');

const MediaVariantSchema = new mongoose.Schema({
  key: {
    type: String,
    enum: ['thumb', 'standard', 'large', 'original'],
      required: true,
  },
  format: {
    type: String,
    enum: ['avif', 'webp', 'png', 'jpg'],
      required: true,
  },
  width: { type: Number, required: true, min: 1 },
  height: { type: Number, required: true, min: 1 },

  // Where the file lives
  url: { type: String, required: true },

  // Optional for integrity + dedupe
  bytes: { type: Number, min: 0 },
  sha256: { type: String }, // hex string
},
{ _id: false }
);

const MediaVariant = mongoose.model('MediaVariant', MediaVariantSchema);
module.exports = { MediaVariant, MediaVariantSchema };
