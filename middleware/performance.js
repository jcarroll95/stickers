// Memory store for metrics
const metrics = {
    totalRequests: 0,
    totalResponseTime: 0, // in ms
    statusCodes: {},
    recentRequests: [] // store last 100 requests
};

const performanceMiddleware = (req, res, next) => {
    const start = process.hrtime();

    res.on('finish', () => {
        const diff = process.hrtime(start);
        const timeInMs = (diff[0] * 1e3 + diff[1] * 1e-6);

        metrics.totalRequests++;
        metrics.totalResponseTime += timeInMs;
        
        const status = res.statusCode;
        metrics.statusCodes[status] = (metrics.statusCodes[status] || 0) + 1;

        // Keep last 100 requests for detailed view if needed
        metrics.recentRequests.push({
            method: req.method,
            url: req.originalUrl,
            status,
            responseTime: timeInMs.toFixed(2),
            timestamp: new Date().toISOString()
        });

        if (metrics.recentRequests.length > 100) {
            metrics.recentRequests.shift();
        }
    });

    next();
};

const getMetrics = () => {
    const avgResponseTime = metrics.totalRequests > 0 
        ? (metrics.totalResponseTime / metrics.totalRequests).toFixed(2) 
        : 0;

    const errorCount = Object.keys(metrics.statusCodes).reduce((acc, code) => {
        if (parseInt(code) >= 400) {
            return acc + metrics.statusCodes[code];
        }
        return acc;
    }, 0);

    const errorRate = metrics.totalRequests > 0 
        ? ((errorCount / metrics.totalRequests) * 100).toFixed(2) 
        : 0;

    return {
        totalRequests: metrics.totalRequests,
        avgResponseTime: `${avgResponseTime}ms`,
        errorRate: `${errorRate}%`,
        statusCodes: metrics.statusCodes,
        recentRequests: metrics.recentRequests
    };
};

module.exports = {
    performanceMiddleware,
    getMetrics
};
