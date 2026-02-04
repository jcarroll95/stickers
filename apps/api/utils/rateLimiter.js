/**
 * In-memory rate limiter for thumbnail uploads
 * Tracks uploads per user per board
 */

// Map structure: "userId:boardId" -> timestamp
const uploadTimestamps = new Map();

// Cleanup old entries every 5 minutes to prevent memory leak
setInterval(() => {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes

    for (const [key, timestamp] of uploadTimestamps.entries()) {
        if (now - timestamp > maxAge) {
            uploadTimestamps.delete(key);
        }
    }
}, 5 * 60 * 1000);

/**
 * Check if user is rate limited for uploading to a specific board
 * @param {string} userId - The user ID
 * @param {string} boardId - The stickerboard ID
 * @param {number} windowMs - Rate limit window in milliseconds (default: 60000 = 60 seconds)
 * @returns {boolean} True if rate limited
 */
function isRateLimited(userId, boardId, windowMs = 30000) {
    const key = `${userId}:${boardId}`;
    const lastUpload = uploadTimestamps.get(key);

    if (!lastUpload) {
        return false;
    }

    const timeSinceLastUpload = Date.now() - lastUpload;
    return timeSinceLastUpload < windowMs;
}

/**
 * Update the rate limit timestamp for a user and board
 * @param {string} userId - The user ID
 * @param {string} boardId - The stickerboard ID
 */
function updateRateLimit(userId, boardId) {
    const key = `${userId}:${boardId}`;
    uploadTimestamps.set(key, Date.now());
}

/**
 * Get time remaining until user can upload again
 * @param {string} userId - The user ID
 * @param {string} boardId - The stickerboard ID
 * @param {number} windowMs - Rate limit window in milliseconds (default: 60000)
 * @returns {number} Milliseconds until next allowed upload, or 0 if can upload now
 */
function getTimeRemaining(userId, boardId, windowMs = 30000) {
    const key = `${userId}:${boardId}`;
    const lastUpload = uploadTimestamps.get(key);

    if (!lastUpload) {
        return 0;
    }

    const timeSinceLastUpload = Date.now() - lastUpload;
    const remaining = windowMs - timeSinceLastUpload;

    return remaining > 0 ? remaining : 0;
}

module.exports = {
    isRateLimited,
    updateRateLimit,
    getTimeRemaining,
};
