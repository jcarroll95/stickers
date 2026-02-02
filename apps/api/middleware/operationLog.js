const OperationLog = require('../models/OperationLog');

const validateOperationId = async (req, res, next) => {
    const { opId } = req.body;

    if (opId) {
        try {
            // Check if operation ID exists and is completed
            const existingOp = await OperationLog.findOne({
                opId,
                status: 'completed'
            });

            if (existingOp) {
                return res.status(409).json({
                    success: false,
                    message: 'Operation already completed',
                    data: existingOp.result
                });
            }
        } catch (error) {
            return next(error);
        }
    }

    next();
};

module.exports = { validateOperationId };