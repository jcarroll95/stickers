/**
 * Run `work` inside a Mongo transaction when supported; otherwise rerun `work` without a session.
 *
 * `work` receives:
 *   { session, sessionOpt, useTransaction, commit }
 *
 * - session: the mongoose session (or null in fallback)
 * - sessionOpt: { session } (or {} in fallback) for passing into mongoose ops
 * - useTransaction: boolean
 * - commit: whether the caller should commit (this helper commits automatically when true)
 */

function isTxnNotSupportedError(err) {
  const msg = String(err?.message || '');
  return (
    err?.code === 20 ||
    msg.includes('replica set') ||
    msg.includes('Transaction numbers') ||
    msg.includes('only allowed on a replica set member') ||
    msg.includes('mongos')
  );
}

async function safeAbort(session) {
  try {
    if (session?.inTransaction?.()) {
      await session.abortTransaction();
    }
  } catch (_) {
    // swallow abort errors (we're already handling an error path)
  }
}

async function withOptionalTransaction(mongoose, work) {
  if (!mongoose || typeof mongoose.startSession !== 'function') {
    throw new Error('withOptionalTransaction: mongoose instance with startSession() is required');
  }
  if (typeof work !== 'function') {
    throw new Error('withOptionalTransaction: work callback is required');
  }

  const session = await mongoose.startSession();

  try {
    // Attempt transactional path
    await session.startTransaction();

    try {
      await work({ session, sessionOpt: { session }, useTransaction: true, commit: true });
      await session.commitTransaction();
      return;
    } catch (err) {
      // If the error indicates txns aren’t supported, fall back by rerunning without session.
      if (isTxnNotSupportedError(err)) {
        await safeAbort(session);
        await work({ session: null, sessionOpt: {}, useTransaction: false, commit: false });
        return;
      }

      // Real application error: abort + rethrow
      await safeAbort(session);
      throw err;
    }
  } catch (err) {
    // startTransaction failed (or commit failed) — fall back only for “txn not supported”
    if (isTxnNotSupportedError(err)) {
      await safeAbort(session);
      await work({ session: null, sessionOpt: {}, useTransaction: false, commit: false });
      return;
    }

    await safeAbort(session);
    throw err;
  } finally {
    session.endSession();
  }
}

module.exports = { withOptionalTransaction };

