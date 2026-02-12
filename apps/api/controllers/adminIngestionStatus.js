// apps/api/controllers/adminIngestionStatus.js

const asyncHandler = require('../middleware/async');
const { getIngestionStatus, listRecentIngestionOps } = require('../usecases/ingestionStatusUsecases');

/**
 * GET /api/v1/admin/catalog/ingest-batch/:batchId
 * Read-only operational status for a given batchId.
 */
exports.getBatchStatus = asyncHandler(async (req, res) => {
  const batchId = req.params.batchId;

  const status = await getIngestionStatus({ batchId });

  if (!status.found) {
    return res.status(404).json({ ok: false, error: 'Batch not found', batchId });
  }

  res.json({ ok: true, status });
});

/**
 * GET /api/v1/admin/catalog/ingest-batch
 * Query: ?limit=20
 * Lists most recent ingestion operations for admin visibility.
 */
exports.listBatches = asyncHandler(async (req, res) => {
  const limit = req.query.limit;
  const items = await listRecentIngestionOps({ limit });

  res.json({ ok: true, items });
});
