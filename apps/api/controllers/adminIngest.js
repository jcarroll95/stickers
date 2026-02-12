// apps/api/controllers/adminIngest.js

const asyncHandler = require('../middleware/async');
const { ingestUploadBatch } = require('../usecases/ingestionUsecases');
const { validateUploadBatch } = require('../usecases/validateIngestionUsecases'); // you will add this usecase

/**
 * POST /api/v1/admin/catalog/ingest-batch
 * Body: { batchId: string }
 */
exports.ingestBatch = asyncHandler(async (req, res) => {
  const actor = { id: req.user?._id || req.user?.id, role: req.user?.role };

  const batchId = req.body?.batchId;
  if (!batchId) {
    return res.status(400).json({ success: false, error: 'batchId is required' });
  }

  const result = await ingestUploadBatch({
    batchId,
    actor: actor.id,
  });

  res.json(result);
});

/**
 * POST /api/v1/admin/catalog/ingest-batch/validate
 * Body: { batchId: string }
 */
exports.validateBatch = asyncHandler(async (req, res) => {
  const actor = { id: req.user?._id || req.user?.id, role: req.user?.role };

  const batchId = req.body?.batchId;
  if (!batchId) {
    return res.status(400).json({ ok: false, error: 'batchId is required' });
  }

  const report = await validateUploadBatch({
    actor,
    batchId,
    reqForAudit: req,
  });

  res.json({ ok: true, report });
});
