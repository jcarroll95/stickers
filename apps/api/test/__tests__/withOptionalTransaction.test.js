// apps/api/test/__tests__/withOptionalTransaction.test.js

const { withOptionalTransaction } = require('../../infra/db/withOptionalTransaction');

function makeSessionMock() {
  return {
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    abortTransaction: jest.fn().mockResolvedValue(undefined),
    endSession: jest.fn(),
    inTransaction: jest.fn().mockReturnValue(true),
  };
}

describe('withOptionalTransaction', () => {
  test('runs work in a transaction when supported, then commits and ends session', async () => {
    const session = makeSessionMock();

    const mongooseMock = {
      startSession: jest.fn().mockResolvedValue(session),
    };

    const work = jest.fn().mockResolvedValue(undefined);

    await withOptionalTransaction(mongooseMock, work);

    expect(mongooseMock.startSession).toHaveBeenCalledTimes(1);
    expect(session.startTransaction).toHaveBeenCalledTimes(1);

    expect(work).toHaveBeenCalledTimes(1);
    expect(work).toHaveBeenCalledWith(
      expect.objectContaining({
        session,
        sessionOpt: { session },
        useTransaction: true,
      })
    );

    expect(session.commitTransaction).toHaveBeenCalledTimes(1);
    expect(session.abortTransaction).not.toHaveBeenCalled();
    expect(session.endSession).toHaveBeenCalledTimes(1);
  });

  test('falls back to non-transaction mode when transactions are not supported', async () => {
    const session = makeSessionMock();

    // Simulate the classic non-replica-set error condition
    const txnNotSupportedErr = new Error(
      'Transaction numbers are only allowed on a replica set member or mongos'
    );
    txnNotSupportedErr.code = 20;

    // startTransaction fails, and (realistically) no transaction is active
    session.startTransaction.mockRejectedValueOnce(txnNotSupportedErr);
    session.inTransaction.mockReturnValue(false);

    const mongooseMock = {
      startSession: jest.fn().mockResolvedValue(session),
    };

    const work = jest.fn().mockResolvedValue(undefined);

    await withOptionalTransaction(mongooseMock, work);

    expect(mongooseMock.startSession).toHaveBeenCalledTimes(1);
    expect(session.startTransaction).toHaveBeenCalledTimes(1);

    // In fallback, work should be invoked WITHOUT session/sessionOpt
    expect(work).toHaveBeenCalledTimes(1);
    expect(work).toHaveBeenCalledWith(
      expect.objectContaining({
        session: null,
        sessionOpt: {},
        useTransaction: false,
      })
    );

    // No commit when no transaction
    expect(session.commitTransaction).not.toHaveBeenCalled();
    // No abort needed if txn never started successfully (and inTransaction=false)
    expect(session.abortTransaction).not.toHaveBeenCalled();

    expect(session.endSession).toHaveBeenCalledTimes(1);
  });

  test('aborts and rethrows when work fails with a real error', async () => {
    const session = makeSessionMock();

    const mongooseMock = {
      startSession: jest.fn().mockResolvedValue(session),
    };

    const workErr = new Error('boom');
    const work = jest.fn().mockRejectedValue(workErr);

    await expect(withOptionalTransaction(mongooseMock, work)).rejects.toThrow('boom');

    expect(session.startTransaction).toHaveBeenCalledTimes(1);
    expect(work).toHaveBeenCalledTimes(1);

    // Abort should occur at least once for a real work failure.
    // (Implementation may defensively abort in nested handlers.)
    expect(session.abortTransaction).toHaveBeenCalled();
    expect(session.commitTransaction).not.toHaveBeenCalled();

    // endSession must always happen
    expect(session.endSession).toHaveBeenCalledTimes(1);
  });
});
