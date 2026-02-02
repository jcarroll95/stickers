// Memory store for metrics
const metrics = {
    totalRequests: 0,
    totalResponseTimeMs: 0,
    statusCodes: {},
    recentRequests: [], // store last 100 API requests
    maxRecent: 100
};

function computePercentile(values, percentile) {
    if (!values || values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const idx = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

const performanceMiddleware = (req, res, next) => {
    // Only track API requests
    const url = req.originalUrl || '';
    if (!url.startsWith('/api/')) return next();

    // Optional skip rules to reduce self-noise
    if (url === '/api/v1/admin/metrics') return next();

    const start = process.hrtime();

    res.on('finish', () => {
        const diff = process.hrtime(start);
        const timeInMs = diff[0] * 1e3 + diff[1] * 1e-6;

        metrics.totalRequests += 1;
        metrics.totalResponseTimeMs += timeInMs;

        const status = res.statusCode;
        metrics.statusCodes[status] = (metrics.statusCodes[status] || 0) + 1;

        metrics.recentRequests.push({
            requestId: req.id || req.get('X-Request-Id') || null,
            method: req.method,
            url,
            status,
            responseTimeMs: Math.round(timeInMs * 100) / 100, // numeric
            ip: req.ip,
            timestamp: new Date().toISOString()
        });

        if (metrics.recentRequests.length > metrics.maxRecent) {
            metrics.recentRequests.shift();
        }
    });

    next();
};

const getMetrics = () => {
    const avgResponseTimeMs =
        metrics.totalRequests > 0
            ? metrics.totalResponseTimeMs / metrics.totalRequests
            : 0;

    const errorCount = Object.keys(metrics.statusCodes).reduce((acc, code) => {
        if (parseInt(code, 10) >= 400) return acc + metrics.statusCodes[code];
        return acc;
    }, 0);

    const errorRate =
        metrics.totalRequests > 0
            ? (errorCount / metrics.totalRequests) * 100
            : 0;

    const recentLatencies = metrics.recentRequests.map((r) => r.responseTimeMs);
    const p50 = computePercentile(recentLatencies, 50);
    const p95 = computePercentile(recentLatencies, 95);
    const p99 = computePercentile(recentLatencies, 99);

    return {
        totalRequests: metrics.totalRequests,
        avgResponseTimeMs: Math.round(avgResponseTimeMs * 100) / 100,
        errorRatePercent: Math.round(errorRate * 100) / 100,
        statusCodes: metrics.statusCodes,
        latencyRecent: {
            count: metrics.recentRequests.length,
            p50Ms: Math.round(p50 * 100) / 100,
            p95Ms: Math.round(p95 * 100) / 100,
            p99Ms: Math.round(p99 * 100) / 100
        },
        recentRequests: metrics.recentRequests
    };
};

module.exports = {
    performanceMiddleware,
    getMetrics
};
