// apps/api/controllers/adminIngest.js
const { ingestUploadBatch } = require('../usecases/ingestionUsecases');

exports.ingestBatch = async (req, res, next) => {
  try {
    const { batchId } = req.body;

    if (!batchId) {
      return res.status(400).json({ success: false, error: 'batchId is required' });
    }

    const result = await ingestUploadBatch({
      batchId,
      actor: req.user?.id
      // DO NOT pass uploadsRoot; let usecase resolve repo root cleanly
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
};
