// apps/api/usecases/admin/packs/unpublishPack.js

const StickerPack = require('../../../models/StickerPack');
const StickerDefinition = require('../../../models/StickerDefinition');

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
      // ignore
    }
  }
  return null;
}

const auditFn = resolveAuditFn();

async function auditSafe(payload) {
  if (typeof auditFn !== 'function') {
    console.warn('[audit] audit function not wired; skipping', {
      action: payload?.action,
      entityType: payload?.entityType,
      entityId: payload?.entityId,
    });
    return;
  }
  await auditFn(payload);
}

async function unpublishPack({ actor, packId, reqForAudit }) {
  if (!actor?.id) throw new Error('actor.id is required');
  if (!packId) throw new Error('packId is required');

  const pack = await StickerPack.findById(packId);
  if (!pack) throw new Error('Pack not found');

  const wasActive = !!pack.isActive;

  // Idempotent unpublish
  if (pack.isActive) {
    pack.isActive = false;
    await pack.save();
  }

  // Pack+sticker gating: flip stickers to inactive
  const res = await StickerDefinition.updateMany(
    { packId: pack._id },
    { $set: { status: 'inactive' } }
  );

  const stickersDeactivated = res?.modifiedCount ?? res?.nModified ?? 0;

  await auditSafe({
    actor,
    action: 'pack.unpublish',
    entityType: 'StickerPack',
    entityId: String(pack._id),
    before: { isActive: wasActive },
    after: { isActive: false },
    meta: { stickersDeactivated },
    req: reqForAudit,
  });

  return { pack, stickersDeactivated };
}

module.exports = { unpublishPack };
