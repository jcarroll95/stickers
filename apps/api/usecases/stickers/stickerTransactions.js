// apps/api/usecases/stickers/stickerTransactions.js

const mongoose = require('mongoose');
const ErrorResponse = require('../../utils/errorResponse');
const { emitAuditEvent } = require('../../utils/audit');

const StickerInventory = require('../../models/StickerInventory');
const StickerDefinition = require('../../models/StickerDefinition');

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
    // 1) Idempotency check
    const existingTransaction = await StickerInventory.findOne({ userId, stickerId, opId }).session(session);
    if (existingTransaction) {
      await session.commitTransaction();
      return { result: existingTransaction, message: 'Transaction already completed' };
    }

    // 2) Existing inventory entry
    const existingSticker = await StickerInventory.findOne({ userId, stickerId }).session(session);

    if (existingSticker) {
      existingSticker.quantity += 1;
      existingSticker.opId = opId;
      existingSticker.updatedAt = new Date();

      // Backfill packId if missing
      if (!existingSticker.packId) {
        const stickerDef = await StickerDefinition.findById(stickerId).session(session);
        if (stickerDef?.packId) existingSticker.packId = stickerDef.packId;
      }

      await existingSticker.save({ session });

      await emitAuditEvent(req, {
        entityType: 'StickerDefinition',
        entityId: stickerId,
        action: 'sticker.award',
        meta: { userId, opId, quantity: 1, method: 'increment' },
      });

      await session.commitTransaction();
      return { result: existingSticker, message: 'Sticker quantity incremented' };
    }

    // 3) Create new entry; fetch packId from definition
    const stickerDef = await StickerDefinition.findById(stickerId).session(session);

    const newStickerEntry = new StickerInventory({
      userId,
      stickerId,
      packId: stickerDef ? stickerDef.packId : null,
      opId,
      quantity: 1,
      timestamp: new Date(),
    });

    await newStickerEntry.save({ session });

    await emitAuditEvent(req, {
      entityType: 'StickerDefinition',
      entityId: stickerId,
      action: 'sticker.award',
      meta: { userId, opId, quantity: 1, method: 'create' },
    });

    await session.commitTransaction();
    return { result: newStickerEntry, message: 'Sticker awarded successfully' };
  } catch (err) {
    await session.abortTransaction();
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
async function revokeSticker({ userId, stickerId, opId, req }) {
  if (!userId || !stickerId || !opId) {
    throw new ErrorResponse('userId, stickerId, and opId are required', 400);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // 1) Idempotency check
    const existingTransaction = await StickerInventory.findOne({ userId, stickerId, opId }).session(session);
    if (existingTransaction) {
      await session.commitTransaction();
      return { result: existingTransaction, message: 'Transaction already completed' };
    }

    // 2) Decrement
    const stickerEntry = await StickerInventory.findOne({ userId, stickerId }).session(session);

    if (!stickerEntry || stickerEntry.quantity <= 0) {
      throw new ErrorResponse('Sticker not available in user inventory', 404);
    }

    stickerEntry.quantity -= 1;
    stickerEntry.opId = opId;
    stickerEntry.updatedAt = new Date();
    await stickerEntry.save({ session });

    await emitAuditEvent(req, {
      entityType: 'StickerDefinition',
      entityId: stickerId,
      action: 'sticker.revoke',
      meta: { userId, opId, quantity: 1 },
    });

    await session.commitTransaction();
    return { result: stickerEntry, message: 'Sticker consumed successfully' };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

module.exports = { awardSticker, revokeSticker };
