// apps/api/usecases/ingestionStatusUsecases.js

const OperationLog = require('../models/OperationLog');

function required(v, msg) {
  if (!v) throw new Error(msg);
  return v;
}

function toStatusDto(op) {
  return {
    opId: op.opId,
    batchId: op.batchId,
    operationType: op.operationType,
    status: op.status,
    phase: op.phase,
    progress: op.progress,
    manifestDigest: op.manifestDigest,
    lockOwner: op.lockOwner,
    lockExpiresAt: op.lockExpiresAt,
    errorMessage: op.errorMessage,
    createdAt: op.createdAt,
    updatedAt: op.updatedAt,
    completedAt: op.completedAt,
    failedAt: op.failedAt,
    // note: payload.tracking can be huge; omit by default
  };
}

async function getIngestionStatus({ batchId }) {
  required(batchId, 'batchId is required');

  const op = await OperationLog.findOne({
    operationType: 'catalogIngestion',
    batchId,
  }).lean();

  if (!op) {
    return {
      found: false,
      batchId,
    };
  }

  return {
    found: true,
    ...toStatusDto(op),
  };
}

async function listRecentIngestionOps({ limit = 20 }) {
  const n = Math.max(1, Math.min(Number(limit) || 20, 100));

  const ops = await OperationLog.find({ operationType: 'catalogIngestion' })
    .sort({ createdAt: -1 })
    .limit(n)
    .lean();

  return ops.map(toStatusDto);
}

module.exports = { getIngestionStatus, listRecentIngestionOps };
