/**
 * Operation ID Generator for Idempotent Operations
 * Generates UUIDv4 operation IDs and manages pending operations in localStorage
 */

/**
 * Generate a UUIDv4 operation ID
 * @returns {string} UUIDv4 string
 */
export function generateOpId() {
  // Use crypto.randomUUID if available (modern browsers)
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  // Fallback polyfill for UUIDv4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Store a pending operation in localStorage
 * @param {string} opId - Operation ID
 * @param {object} metadata - Operation metadata (type, payload, etc.)
 */
export function storePendingOperation(opId, metadata) {
  try {
    const pending = getPendingOperations();
    pending[opId] = {
      ...metadata,
      createdAt: Date.now(),
      status: 'pending'
    };
    localStorage.setItem('pendingOperations', JSON.stringify(pending));
  } catch (err) {
    console.error('[OpId] Failed to store pending operation:', err);
  }
}

/**
 * Get all pending operations from localStorage
 * @returns {object} Map of opId -> metadata
 */
export function getPendingOperations() {
  try {
    const raw = localStorage.getItem('pendingOperations');
    return raw ? JSON.parse(raw) : {};
  } catch (err) {
    console.error('[OpId] Failed to retrieve pending operations:', err);
    return {};
  }
}

/**
 * Mark an operation as completed and remove from pending
 * @param {string} opId - Operation ID
 */
export function completeOperation(opId) {
  try {
    const pending = getPendingOperations();
    delete pending[opId];
    localStorage.setItem('pendingOperations', JSON.stringify(pending));
  } catch (err) {
    console.error('[OpId] Failed to complete operation:', err);
  }
}

/**
 * Mark an operation as failed
 * @param {string} opId - Operation ID
 * @param {string} error - Error message
 */
export function failOperation(opId, error) {
  try {
    const pending = getPendingOperations();
    if (pending[opId]) {
      pending[opId].status = 'failed';
      pending[opId].error = error;
      pending[opId].failedAt = Date.now();
      localStorage.setItem('pendingOperations', JSON.stringify(pending));
    }
  } catch (err) {
    console.error('[OpId] Failed to mark operation as failed:', err);
  }
}

/**
 * Clean up old operations (older than 24 hours)
 */
export function cleanupOldOperations() {
  try {
    const pending = getPendingOperations();
    const now = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;

    let cleaned = false;
    Object.keys(pending).forEach(opId => {
      const op = pending[opId];
      if (op.createdAt && (now - op.createdAt > dayInMs)) {
        delete pending[opId];
        cleaned = true;
      }
    });

    if (cleaned) {
      localStorage.setItem('pendingOperations', JSON.stringify(pending));
    }
  } catch (err) {
    console.error('[OpId] Failed to cleanup old operations:', err);
  }
}

/**
 * Check if an operation ID is pending
 * @param {string} opId
 * @returns {boolean}
 */
export function isPending(opId) {
  const pending = getPendingOperations();
  return pending[opId] && pending[opId].status === 'pending';
}
