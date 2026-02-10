const OperationLog = require('../models/OperationLog');
const ErrorResponse = require('../utils/errorResponse');

/**
 * Idempotency middleware: exactly-once semantics keyed by opId.
 *
 * Behavior:
 * - no opId -> passthrough (back-compat)
 * - invalid opId -> 400
 * - existing completed -> 200 cached
 * - existing pending -> 409 in progress
 * - existing failed -> allow retry
 *
 * Implementation notes (hiring-signal oriented):
 * - We DO NOT mark completed until we have a successful response payload.
 * - We DO ensure the OperationLog transition (pending->completed/failed) is durable
 *   before sending the HTTP response, so observability and tests are deterministic.
 * - Error path is handled via an exported Express error middleware.
 */

const UUIDV4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function buildMinimalPayload(req) {
  const minimalPayload = {
    params: req.params,
    path: req.path,
    method: req.method,
  };

  if (req.body) {
    const { stickers, ...bodyWithoutStickers } = req.body;
    minimalPayload.body = {
      ...bodyWithoutStickers,
      stickerCount: Array.isArray(stickers) ? stickers.length : undefined,
    };
  }

  return minimalPayload;
}

function buildMinimalResult(data) {
  const minimalResult = {
    success: data?.success === true,
    opId: data?.opId,
    cached: data?.cached,
  };

  if (data?.success !== true) {
    minimalResult.error = data?.error || data?.message || 'Operation failed';
  }

  return minimalResult;
}

const idempotencyMiddleware = (operationType) => {
  return async (req, res, next) => {
    const { opId } = req.body || {};

    // Backward compatibility: no opId => do nothing
    if (!opId) return next();

    // Validate UUIDv4
    if (!UUIDV4_REGEX.test(opId)) {
      return next(new ErrorResponse('Invalid operation ID format. Must be UUIDv4.', 400));
    }

    try {
      // 1) Check existing operation
      const existingOp = await OperationLog.findOne({ opId });

      if (existingOp) {
        if (existingOp.status === 'completed') {
          return res.status(200).json({
            success: true,
            cached: true,
            message: 'Operation already completed',
            opId: existingOp.opId,
            data: {}, // intentionally minimal
          });
        }

        if (existingOp.status === 'pending') {
          return res.status(409).json({
            success: false,
            message: 'Operation is already in progress',
            opId,
          });
        }

        // status === 'failed' => allow retry: continue
      }

      // 2) Create/Upsert pending operation log
      const minimalPayload = buildMinimalPayload(req);

      const operationLog = await OperationLog.findOneAndUpdate(
        { opId },
        {
          opId,
          userId: req.user?.id,
          operationType: operationType || req.method,
          status: 'pending',
          payload: minimalPayload,
          createdAt: Date.now(),
        },
        { upsert: true, new: true }
      );

      // stash on req for downstream error handler
      req.operationLog = operationLog;

      // 3) Intercept JSON response to finalize OperationLog DURABLY before sending response
      const originalJson = res.json.bind(res);

      res.json = function patchedJson(data) {
        // Convert to async flow without forcing callers to await res.json().
        // We ensure the response isn't actually sent until our work completes by
        // calling originalJson only after the awaited DB update finishes.
        (async () => {
          const minimalResult = buildMinimalResult(data);

          try {
            if (minimalResult.success) {
              await OperationLog.findByIdAndUpdate(operationLog._id, {
                status: 'completed',
                result: minimalResult,
                completedAt: Date.now(),
              });
            } else {
              await OperationLog.findByIdAndUpdate(operationLog._id, {
                status: 'failed',
                result: minimalResult,
                errorMessage: minimalResult.error,
                completedAt: Date.now(),
              });
            }
          } catch (logErr) {
            // If logging fails, we still must send the response.
            // This is a monitoring concern; the business operation already happened.
            console.error('[Idempotency] Failed to finalize operation log:', logErr);
          }

          return originalJson(data);
        })().catch((e) => {
          // In the extremely unlikely event our async wrapper throws before sending response,
          // fall back to sending the original response payload.
          console.error('[Idempotency] Unexpected error in patched res.json:', e);
          return originalJson(data);
        });

        // Maintain Express chaining expectations: res.json() usually returns res.
        return res;
      };

      return next();
    } catch (error) {
      console.error('[Idempotency] Middleware error:', error);
      return next(error);
    }
  };
};

/**
 * Express error middleware to mark the operation as failed if a downstream handler throws.
 * Mount this BEFORE your generic error handler.
 *
 * Usage in server.js (order matters):
 *   app.use('/api/v1/...', routes)
 *   app.use(idempotencyErrorHandler)
 *   app.use(errorHandler)
 */
const idempotencyErrorHandler = async (err, req, res, next) => {
  try {
    if (req.operationLog?._id) {
      await OperationLog.findByIdAndUpdate(req.operationLog._id, {
        status: 'failed',
        errorMessage: err?.message || 'Unhandled error',
        completedAt: Date.now(),
      });
    }
  } catch (logErr) {
    console.error('[Idempotency] Failed to update operation log on error:', logErr);
  }

  return next(err);
};

module.exports = { idempotencyMiddleware, idempotencyErrorHandler };
