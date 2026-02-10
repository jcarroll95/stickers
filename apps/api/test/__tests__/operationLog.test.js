const { validateOperationId } = require('../../middleware/operationLog');
const OperationLog = require('../../models/OperationLog');

jest.mock('../../models/OperationLog');

describe('validateOperationId Middleware', () => {
  let req, res, next;

  beforeEach(() => {
    req = { body: {} };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    next = jest.fn();
    jest.clearAllMocks();
  });

  test('calls next() if no opId is provided', async () => {
    await validateOperationId(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(OperationLog.findOne).not.toHaveBeenCalled();
  });

  test('calls next() if opId is provided but not found in logs', async () => {
    req.body.opId = 'new-op-123';
    OperationLog.findOne.mockResolvedValue(null);

    await validateOperationId(req, res, next);

    expect(OperationLog.findOne).toHaveBeenCalledWith({
      opId: 'new-op-123',
      status: 'completed'
    });
    expect(next).toHaveBeenCalled();
  });

  test('returns 409 if operation already completed', async () => {
    req.body.opId = 'existing-op-123';
    const existingOp = {
      opId: 'existing-op-123',
      status: 'completed',
      result: { some: 'data' }
    };
    OperationLog.findOne.mockResolvedValue(existingOp);

    await validateOperationId(req, res, next);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Operation already completed',
      data: existingOp.result
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('calls next(error) if database query fails', async () => {
    req.body.opId = 'error-op-123';
    const error = new Error('Database connection failed');
    OperationLog.findOne.mockRejectedValue(error);

    await validateOperationId(req, res, next);

    expect(next).toHaveBeenCalledWith(error);
  });
});
