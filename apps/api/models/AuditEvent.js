const mongoose = require('mongoose');

const AuditEventSchema = new mongoose.Schema(
  {
    entityType: {
      type: String,
      enum: ['StickerDefinition', 'StickerPack', 'User', 'System'],
      required: true,
      index: true,
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
      required: false, // allow null for system-level bulk events
      index: true,
    },

    action: {
      type: String,
      required: true,
      index: true,
      // examples: 'sticker.status_change', 'sticker.update', 'pack.update', 'sticker.bulk_activate'
    },

    actorUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false, // allow system actor
      index: true,
    },
    actorType: {
      type: String,
      enum: ['user', 'system'],
      default: 'user',
    },

    // Correlation / debug
    requestId: { type: String, index: true }, // propagate from middleware
    ip: { type: String },
    userAgent: { type: String },

    // Optional: store a compact diff rather than whole docs
    changes: [
      new mongoose.Schema(
        {
          path: { type: String, required: true }, // e.g. 'status', 'rarity', 'packId'
          before: { type: mongoose.Schema.Types.Mixed },
          after: { type: mongoose.Schema.Types.Mixed },
        },
        { _id: false }
      ),
    ],

    // Optional: useful for bulk ops / summaries
    meta: { type: mongoose.Schema.Types.Mixed },

    createdAt: { type: Date, default: Date.now, index: true },
  },
  { versionKey: false }
);

// Helpful compound indexes for common queries
AuditEventSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });
AuditEventSchema.index({ actorUserId: 1, createdAt: -1 });

module.exports =
  mongoose.models.AuditEvent || mongoose.model('AuditEvent', AuditEventSchema);
