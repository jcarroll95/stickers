// apps/api/usecases/audit/adminAudit.js
//
// Thin adapter so all admin usecases call the same function name.
// Update this file to match your actual audit utility exports.

let auditFn = null;

try {
  // OPTION 1: if you have a file like apps/api/usecases/audit/auditUtils.js exporting auditAdminEvent
  // const mod = require('./auditUtils');
  // auditFn = mod.auditAdminEvent;

  // OPTION 2: if you have a util under utils/
  // const mod = require('../../utils/auditLogger');
  // auditFn = mod.auditAdminEvent || mod.auditEvent || mod.logAuditEvent;

  // ---- DEFAULT: do nothing until you wire it correctly ----
  const mod = require('./auditUtils'); // <-- change to your real path
  auditFn = mod.auditAdminEvent || mod.auditEvent || mod.logAuditEvent || mod.recordAuditEvent;
} catch (e) {
  auditFn = null;
}

async function auditAdminEventSafe(payload) {
  if (typeof auditFn !== 'function') {
    // Do NOT break admin operations because audit wiring moved.
    // Still surfaces in server logs so you notice.
    console.warn('[audit] audit function not wired; skipping audit event', {
      action: payload?.action,
      entityType: payload?.entityType,
      entityId: payload?.entityId,
    });
    return;
  }
  return auditFn(payload);
}

module.exports = { auditAdminEventSafe };
