const mongoose = require('mongoose');

const OperationLogSchema = new mongoose.Schema({
    opId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    operationType: {
        type: String,
        enum: ['placeSticker', 'removeSticker', 'consumeSticker', 'transferSticker', 'updateStickerboard'],
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'completed', 'failed'],
        default: 'pending'
    },
    payload: {
        type: mongoose.Schema.Types.Mixed
    },
    result: {
        type: mongoose.Schema.Types.Mixed
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    completedAt: {
        type: Date
    },
    errorMessage: {
        type: String
    }
});

// Compound index for efficient user+opId lookups
OperationLogSchema.index({ userId: 1, opId: 1 });

// TTL index to auto-expire old logs after 30 days
OperationLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

module.exports = mongoose.model('OperationLog', OperationLogSchema);