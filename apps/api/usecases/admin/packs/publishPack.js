// apps/api/usecases/admin/packs/publishPack.js

const StickerPack = require('../../../models/StickerPack');
const StickerDefinition = require('../../../models/StickerDefinition');

/**
 * Try to resolve your audit function without making publish/unpublish brittle.
 * Update the candidates list to your actual audit module later (one place).
 */
function resolveAuditFn() {
  const candidates = [
    // Add your real audit module path(s) here if you know them:
    // '../../audit/auditUtils',
    // '../../audit/auditLogging',
    // '../../../utils/auditLogger',
  ];

  for (const modPath of candidates) {
    try {
      const mod = require(modPath);
      const fn =
        mod.auditAdminEvent ||
        mod.auditEvent ||
        mod.logAuditEvent ||
        mod.recordAuditEvent ||
        mod.recordAdminAudit;

      if (typeof fn === 'function') return fn;
    } catch {
      // ignore missing modules
    }
  }
  return null;
}

const auditFn = resolveAuditFn();

async function auditSafe(payload) {
  if (typeof auditFn !== 'function') {
    // Never break admin ops because audit is miswired.
    console.warn('[audit] audit function not wired; skipping', {
      action: payload?.action,
      entityType: payload?.entityType,
      entityId: payload?.entityId,
    });
    return;
  }
  await auditFn(payload);
}

async function publishPack({ actor, packId, reqForAudit }) {
  if (!actor?.id) throw new Error('actor.id is required');
  if (!packId) throw new Error('packId is required');

  const pack = await StickerPack.findById(packId);
  if (!pack) throw new Error('Pack not found');

  const wasActive = !!pack.isActive;

  // Idempotent publish
  if (!pack.isActive) {
    pack.isActive = true;
    await pack.save();
  }

  // Pack+sticker gating: flip stickers to active
  const res = await StickerDefinition.updateMany(
    { packId: pack._id },
    { $set: { status: 'active' } }
  );

  const stickersActivated = res?.modifiedCount ?? res?.nModified ?? 0;

  await auditSafe({
    actor,
    action: 'pack.publish',
    entityType: 'StickerPack',
    entityId: String(pack._id),
    before: { isActive: wasActive },
    after: { isActive: true },
    meta: { stickersActivated },
    req: reqForAudit,
  });

  return { pack, stickersActivated };
}

module.exports = { publishPack };
