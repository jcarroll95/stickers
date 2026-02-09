const mongoose = require('mongoose');

async function withOptionalTransaction(mongoose, work) {
  const session = await mongoose.startSession();
  let useTransaction = true;

  try {
    await session.startTransaction();
    await work({ session, sessionOpt: { session }, useTransaction: true, commit: true });
    await session.commitTransaction();
  } catch (err) {
    // detect "transactions not supported" and fallback by rerunning without session
    // OR if transaction started, abort then rethrow
  } finally {
    session.endSession();
  }
}
module.exports = { withOptionalTransaction };

