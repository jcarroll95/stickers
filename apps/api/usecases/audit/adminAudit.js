// apps/api/usecases/audit/adminAudit.js

// Thin adapter: admin usecases pass a rich payload.
// This adapter forwards to utils/audit.emitAuditEvent(req, event),
// which performs the actual Mongoose write.

let emitAuditEventFn = null;

try {
  const mod = require('../../utils/audit');
  emitAuditEventFn = mod.emitAuditEvent;
} catch (e) {
  emitAuditEventFn = null;
}

/**
 * payload shape:
 * {
 *   req,                 // Express req (optional but recommended)
 *   action,
 *   entityType,
 *   entityId,
 *   actor,               // optional additional actor metadata
 *   before, after, meta  // optional
 *   ...any other fields you want stored on AuditEvent
 * }
 */
async function auditAdminEventSafe(payload) {
  if (typeof emitAuditEventFn !== 'function') {
    console.warn('[audit] emitAuditEvent not wired; skipping audit event', {
      action: payload?.action,
      entityType: payload?.entityType,
      entityId: payload?.entityId,
    });
    return;
  }

  if (!payload || typeof payload !== 'object') {
    throw new Error('auditAdminEventSafe requires a payload object');
  }

  const { req, ...event } = payload;

  // You *keep* the rich fields. We only separate req vs event for the util signature.
  return emitAuditEventFn(req, event);
}

module.exports = { auditAdminEventSafe };
