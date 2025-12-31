const express = require('express');
const router = express.Router();
const { getMetrics } = require('../middleware/performance');
const { protect, authorize } = require('../middleware/auth');

// All routes here are for admins only
router.use(protect);
router.use(authorize('admin'));

router.get('/metrics', (req, res) => {
    const metrics = getMetrics();
    res.status(200).json({
        success: true,
        data: metrics
    });
});

module.exports = router;
