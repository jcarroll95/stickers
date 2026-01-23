// middleware/requestId.js
const crypto = require('crypto');

// Generates a compact request ID suitable for logs and headers.
function generateRequestId() {
    // 12 bytes -> 24 hex chars. Short, unique enough for request tracing.
    return crypto.randomBytes(12).toString('hex');
}

function requestIdMiddleware(req, res, next) {
    // Prefer inbound header if provided (useful for browser->api correlation)
    const inbound = req.get('X-Request-Id');

    // Basic sanitation: limit size and characters
    const safeInbound =
        typeof inbound === 'string' &&
        inbound.length > 0 &&
        inbound.length <= 64 &&
        /^[a-zA-Z0-9._-]+$/.test(inbound)
            ? inbound
            : null;

    const id = safeInbound || generateRequestId();

    // Attach to request for use in app logs/metrics
    req.id = id;

    // Echo back for clients (and for support/debug)
    res.setHeader('X-Request-Id', id);

    next();
}

module.exports = { requestIdMiddleware };