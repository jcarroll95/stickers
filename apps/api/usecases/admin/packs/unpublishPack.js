// apps/api/usecases/admin/packs/unpublishPack.js

const StickerPack = require('../../../models/StickerPack');
const StickerDefinition = require('../../../models/StickerDefinition');
const { auditAdminEventSafe } = require('../../audit/adminAudit');

async function unpublishPack({ actor, packId, reqForAudit }) {
  if (!actor?.id) throw new Error('actor.id is required');
  if (!packId) throw new Error('packId is required');

  const pack = await StickerPack.findById(packId);
  if (!pack) throw new Error('Pack not found');

  const wasActive = !!pack.isActive;

  // Idempotent unpublish.
  if (pack.isActive) {
    pack.isActive = false;
    await pack.save();
  }

  // Pack+sticker gating: deactivate stickers.
  const res = await StickerDefinition.updateMany(
    { packId: pack._id },
    { $set: { status: 'retired' } }
  );

  const stickersDeactivated = res?.modifiedCount ?? res?.nModified ?? 0;

  await auditAdminEventSafe({
    req: reqForAudit,
    actor,
    action: 'pack.unpublish',
    entityType: 'StickerPack',
    entityId: String(pack._id),
    before: { isActive: wasActive },
    after: { isActive: false },
    meta: { stickersDeactivated },
  });

  return { pack, stickersDeactivated };
}

module.exports = { unpublishPack };
