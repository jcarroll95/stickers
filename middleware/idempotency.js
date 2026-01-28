const OperationLog = require('../models/OperationLog');
const ErrorResponse = require('../utils/errorResponse');

/**
 * Idempotency middleware for ensuring exactly-once semantics
 * Wraps route handlers and manages operation log entries
 */
const idempotencyMiddleware = (operationType) => {
    return async (req, res, next) => {
        const { opId } = req.body;

        console.log('[Idempotency] Middleware called:', {
            path: req.path,
            method: req.method,
            hasOpId: !!opId,
            opId: opId || 'none',
            operationType
        });

        // If no opId provided, allow operation to proceed (backward compatibility)
        if (!opId) {
            console.log('[Idempotency] No opId provided, skipping idempotency checks');
            return next();
        }

        // Validate opId format (UUIDv4)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(opId)) {
            return next(new ErrorResponse('Invalid operation ID format. Must be UUIDv4.', 400));
        }

        try {
            // Check if operation already exists
            const existingOp = await OperationLog.findOne({ opId });

            if (existingOp) {
                if (existingOp.status === 'completed') {
                    console.log('[Idempotency] Returning cached response for:', opId);
                    // Return cached acknowledgment (client doesn't need full data again)
                    return res.status(200).json({
                        success: true,
                        cached: true,
                        message: 'Operation already completed',
                        opId: existingOp.opId,
                        data: {} // Empty data since operation was already processed
                    });
                }

                if (existingOp.status === 'pending') {
                    // Operation is still in progress (potential race condition)
                    return res.status(409).json({
                        success: false,
                        message: 'Operation is already in progress',
                        opId
                    });
                }

                // If failed, allow retry by continuing to next()
            }

            // Create minimal payload - only store what's needed for debugging
            // Don't store entire stickers array which can be huge
            const minimalPayload = {
                params: req.params,
                path: req.path
            };

            // Only include minimal body info (not the entire stickers array)
            if (req.body) {
                const { stickers, ...bodyWithoutStickers } = req.body;
                minimalPayload.body = {
                    ...bodyWithoutStickers,
                    stickerCount: Array.isArray(stickers) ? stickers.length : undefined
                };
            }

            // Create or update operation log entry as pending
            const operationLog = await OperationLog.findOneAndUpdate(
                { opId },
                {
                    opId,
                    userId: req.user.id,
                    operationType: operationType || req.method,
                    status: 'pending',
                    payload: minimalPayload,
                    createdAt: Date.now()
                },
                { upsert: true, new: true }
            );

            console.log('[Idempotency] Created/Updated operation log:', {
                opId,
                userId: req.user.id,
                operationType: operationType || req.method,
                logId: operationLog._id
            });

            // Store operation log reference for completion handler
            req.operationLog = operationLog;

            // Intercept response to update operation log
            const originalJson = res.json.bind(res);
            res.json = function (data) {
                // Create minimal result - don't store full response
                const minimalResult = {
                    success: data.success,
                    opId: data.opId,
                    cached: data.cached
                };

                // Only include error info if failed
                if (!data.success) {
                    minimalResult.error = data.error || data.message;
                }

                // Only update if operation was successful
                if (data.success) {
                    console.log('[Idempotency] Marking operation as completed:', opId);
                    OperationLog.findByIdAndUpdate(
                        operationLog._id,
                        {
                            status: 'completed',
                            result: minimalResult,
                            completedAt: Date.now()
                        }
                    ).catch(err => {
                        console.error('[Idempotency] Failed to update operation log:', err);
                    });
                } else {
                    console.log('[Idempotency] Marking operation as failed:', opId);
                    OperationLog.findByIdAndUpdate(
                        operationLog._id,
                        {
                            status: 'failed',
                            result: minimalResult,
                            errorMessage: data.error || data.message,
                            completedAt: Date.now()
                        }
                    ).catch(err => {
                        console.error('[Idempotency] Failed to update operation log:', err);
                    });
                }
                return originalJson(data);
            };

            // Handle errors
            const originalNext = next;
            const errorHandler = (err) => {
                if (req.operationLog) {
                    OperationLog.findByIdAndUpdate(
                        req.operationLog._id,
                        {
                            status: 'failed',
                            errorMessage: err.message,
                            completedAt: Date.now()
                        }
                    ).catch(logErr => {
                        console.error('[Idempotency] Failed to update operation log on error:', logErr);
                    });
                }
                return originalNext(err);
            };

            next.call = errorHandler;
            next.apply = errorHandler;

            next();
        } catch (error) {
            console.error('[Idempotency] Middleware error:', error);
            return next(error);
        }
    };
};

module.exports = { idempotencyMiddleware };
