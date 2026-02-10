// utils/audit.js
const AuditEvent = require('../models/AuditEvent');

function getReqContext(req) {
  if (!req) {
    return {
      actorUserId: null,
      actorType: 'system',
      requestId: null,
      ip: null,
      userAgent: null,
    };
  }
  return {
    actorUserId: req.user?._id,            // assumes auth middleware sets req.user
    actorType: req.user ? 'user' : 'system',
    requestId: req.id || req.requestId,
    ip: req.ip,
    userAgent: req.headers ? req.headers['user-agent'] : null,
  };
}

async function emitAuditEvent(req, event) {
  const ctx = getReqContext(req);
  return AuditEvent.create({ ...event, ...ctx });
}

module.exports = { emitAuditEvent };
