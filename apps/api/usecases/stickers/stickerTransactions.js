// apps/api/usecases/stickers/stickerTransactions.js

const mongoose = require('mongoose');
const ErrorResponse = require('../../utils/errorResponse');
const { emitAuditEvent } = require('../../utils/audit');

const StickerInventory = require('../../models/StickerInventory');
const StickerDefinition = require('../../models/StickerDefinition');
const OperationLog = require('../../models/OperationLog');

/**
 * Award (increment) a sticker to a user with idempotency keyed by opId.
 *
 * Semantics preserved from current controller:
 * - If StickerInventory entry exists with (userId, stickerId, opId) => return it (idempotent)
 * - Else if entry exists with (userId, stickerId) => increment quantity, set opId, set packId if missing
 * - Else create new entry with quantity 1 and packId from StickerDefinition
 *
 * @param {{ userId: string, stickerId: string, opId: string, req?: any }} args
 * @returns {Promise<{ result: any, message: string }>}
 */
async function awardSticker({ userId, stickerId, opId, req }) {
  if (!userId || !stickerId || !opId) {
    throw new ErrorResponse('userId, stickerId, and opId are required', 400);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const now = Date.now();
    const LOCK_TIMEOUT_MS = 30 * 1000; // 30 seconds

    // 1) Check OperationLog for existing operation
    const existingOp = await OperationLog.findOne({ opId }).session(session);

    if (existingOp) {
      if (existingOp.status === 'completed') {
        await session.commitTransaction();
        return {
          result: existingOp.result,
          message: 'Transaction already completed'
        };
      }

      if (existingOp.status === 'pending') {
        // Check if lock is still valid
        const lockExpiry = existingOp.lockExpiresAt ? new Date(existingOp.lockExpiresAt).getTime() : 0;

        if (lockExpiry > now) {
          // Lock is active - another request is working on this RIGHT NOW
          await session.abortTransaction();
          const remainingMs = lockExpiry - now;
          throw new ErrorResponse(
            `Operation already in progress. Retry in ${Math.ceil(remainingMs / 1000)}s`,
            409
          );
        }

        // Lock expired - previous attempt crashed/timed out, safe to retry
        console.warn(`[Idempotency] Retrying stale operation ${opId}, expired ${now - lockExpiry}ms ago`);
        // Fall through to retry logic below
      }

      // status === 'failed' with no lock - allow retry
    }

    // 2) Acquire lock by creating/updating operation log
    const lockExpiresAt = new Date(now + LOCK_TIMEOUT_MS);

    const opLog = await OperationLog.findOneAndUpdate(
      { opId },
      {
        opId,
        userId,
        operationType: 'consumeSticker',
        status: 'pending',
        lockOwner: req.id || 'unknown', // requestId for debugging
        lockExpiresAt,
        payload: { userId, stickerId, action: 'award' },
        $setOnInsert: { createdAt: now }
      },
      {
        upsert: true,
        new: true,
        session,
        // This is critical: if multiple requests race to create, only one wins
        setDefaultsOnInsert: true
      }
    );

    // 3) Perform the actual inventory update
    const inventoryEntry = await StickerInventory.findOneAndUpdate(
      { userId, stickerId },
      {
        $inc: { quantity: 1 },
        $setOnInsert: {
          userId,
          stickerId,
          createdAt: now
        },
        $set: { updatedAt: now }
      },
      { upsert: true, new: true, session }
    );

    // Backfill packId if missing
    if (!inventoryEntry.packId) {
      const stickerDef = await StickerDefinition.findById(stickerId).session(session);
      if (stickerDef?.packId) {
        inventoryEntry.packId = stickerDef.packId;
        await inventoryEntry.save({ session });
      }
    }

    // 4) Mark operation as completed and release lock
    await OperationLog.findByIdAndUpdate(
      opLog._id,
      {
        status: 'completed',
        result: {
          inventoryId: inventoryEntry._id,
          newQuantity: inventoryEntry.quantity
        },
        completedAt: now,
        lockOwner: null,
        lockExpiresAt: null
      },
      { session }
    );

    await emitAuditEvent(req, {
      entityType: 'StickerDefinition',
      entityId: stickerId,
      action: 'sticker.award',
      meta: { userId, opId, quantity: 1 },
    });

    await session.commitTransaction();
    return { result: inventoryEntry, message: 'Sticker awarded successfully' };

  } catch (err) {
    await session.abortTransaction();

    // Mark as failed so we don't leave it in pending state
    if (req.operationLog?._id) {
      try {
        await OperationLog.findByIdAndUpdate(req.operationLog._id, {
          status: 'failed',
          errorMessage: err.message,
          completedAt: Date.now(),
          lockOwner: null,
          lockExpiresAt: null
        });
      } catch (logErr) {
        console.error('[Idempotency] Failed to mark operation as failed:', logErr);
      }
    }

    throw err;
  } finally {
    session.endSession();
  }
}

/**
 * Revoke (decrement) a sticker from a user with idempotency keyed by opId.
 *
 * Semantics preserved from current controller:
 * - If StickerInventory entry exists with (userId, stickerId, opId) => return it (idempotent)
 * - Else find (userId, stickerId) and decrement quantity
 * - If none or quantity <= 0 => 404 "Sticker not available in user inventory"
 *
 * @param {{ userId: string, stickerId: string, opId: string, req?: any }} args
 * @returns {Promise<{ result: any, message: string }>}
 */
/**
 * Revoke (decrement) a sticker from a user with idempotency keyed by opId.
 *
 * Proper handling of:
 * - Active locks (reject with 409)
 * - Stale locks (retry after crash/timeout)
 * - Completed operations (return cached result)
 * - Failed operations (allow retry)
 *
 * @param {{ userId: string, stickerId: string, opId: string, req?: any }} args
 * @returns {Promise<{ result: any, message: string }>}
 */
async function revokeSticker({ userId, stickerId, opId, req }) {
  if (!userId || !stickerId || !opId) {
    throw new ErrorResponse('userId, stickerId, and opId are required', 400);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const now = Date.now();
    const LOCK_TIMEOUT_MS = 30 * 1000; // 30 seconds

    // 1) Check OperationLog for existing operation
    const existingOp = await OperationLog.findOne({ opId }).session(session);

    if (existingOp) {
      if (existingOp.status === 'completed') {
        await session.commitTransaction();
        return {
          result: existingOp.result,
          message: 'Transaction already completed'
        };
      }

      if (existingOp.status === 'pending') {
        // Check if lock is still valid
        const lockExpiry = existingOp.lockExpiresAt ? new Date(existingOp.lockExpiresAt).getTime() : 0;

        if (lockExpiry > now) {
          // Lock is active - another request is working on this RIGHT NOW
          await session.abortTransaction();
          const remainingMs = lockExpiry - now;
          throw new ErrorResponse(
            `Operation already in progress. Retry in ${Math.ceil(remainingMs / 1000)}s`,
            409
          );
        }

        // Lock expired - previous attempt crashed/timed out, safe to retry
        console.warn(`[Idempotency] Retrying stale revoke operation ${opId}, expired ${now - lockExpiry}ms ago`);
        // Fall through to retry logic below
      }

      // status === 'failed' with no lock - allow retry
    }

    // 2) Acquire lock by creating/updating operation log
    const lockExpiresAt = new Date(now + LOCK_TIMEOUT_MS);

    const opLog = await OperationLog.findOneAndUpdate(
      { opId },
      {
        opId,
        userId,
        operationType: 'consumeSticker',
        status: 'pending',
        lockOwner: req.id || 'unknown', // requestId for debugging
        lockExpiresAt,
        payload: { userId, stickerId, action: 'revoke' },
        $setOnInsert: { createdAt: now }
      },
      {
        upsert: true,
        new: true,
        session,
        setDefaultsOnInsert: true
      }
    );

    // 3) Check inventory exists and has quantity to revoke
    const stickerEntry = await StickerInventory.findOne({
      userId,
      stickerId
    }).session(session);

    if (!stickerEntry || stickerEntry.quantity <= 0) {
      // Mark operation as failed before throwing
      await OperationLog.findByIdAndUpdate(
        opLog._id,
        {
          status: 'failed',
          errorMessage: 'Sticker not available in user inventory',
          completedAt: now,
          lockOwner: null,
          lockExpiresAt: null
        },
        { session }
      );

      await session.commitTransaction();
      throw new ErrorResponse('Sticker not available in user inventory', 404);
    }

    // 4) Perform the actual inventory decrement
    stickerEntry.quantity -= 1;
    stickerEntry.updatedAt = new Date(now);
    await stickerEntry.save({ session });

    // 5) Mark operation as completed and release lock
    await OperationLog.findByIdAndUpdate(
      opLog._id,
      {
        status: 'completed',
        result: {
          inventoryId: stickerEntry._id,
          newQuantity: stickerEntry.quantity
        },
        completedAt: now,
        lockOwner: null,
        lockExpiresAt: null
      },
      { session }
    );

    await emitAuditEvent(req, {
      entityType: 'StickerDefinition',
      entityId: stickerId,
      action: 'sticker.revoke',
      meta: { userId, opId, quantity: 1 },
    });

    await session.commitTransaction();
    return { result: stickerEntry, message: 'Sticker revoked successfully' };

  } catch (err) {
    await session.abortTransaction();

    // If we created/updated an operation log, mark it as failed
    // (only if not already marked failed in the quantity check above)
    try {
      const existingFailedOp = await OperationLog.findOne({
        opId,
        status: 'failed'
      });

      if (!existingFailedOp) {
        await OperationLog.findOneAndUpdate(
          { opId },
          {
            status: 'failed',
            errorMessage: err.message || 'Unknown error',
            completedAt: Date.now(),
            lockOwner: null,
            lockExpiresAt: null
          }
        );
      }
    } catch (logErr) {
      console.error('[Idempotency] Failed to mark operation as failed:', logErr);
    }

    throw err;
  } finally {
    session.endSession();
  }
}

module.exports = { awardSticker, revokeSticker };
