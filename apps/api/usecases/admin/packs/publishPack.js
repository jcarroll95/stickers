// apps/api/usecases/admin/packs/publishPack.js

const StickerPack = require('../../../models/StickerPack');
const StickerDefinition = require('../../../models/StickerDefinition');
const { auditAdminEventSafe } = require('../../audit/adminAudit');

async function publishPack({ actor, packId, reqForAudit }) {
  if (!actor?.id) throw new Error('actor.id is required');
  if (!packId) throw new Error('packId is required');

  const pack = await StickerPack.findById(packId);
  if (!pack) throw new Error('Pack not found');

  const wasActive = !!pack.isActive;

  // Idempotent publish: keep safe to retry.
  if (!pack.isActive) {
    pack.isActive = true;
    await pack.save();
  }

  // Pack+sticker gating: activate all stickers belonging to the pack.
  const res = await StickerDefinition.updateMany(
    { packId: pack._id },
    { $set: { status: 'active' } }
  );

  const stickersActivated = res?.modifiedCount ?? res?.nModified ?? 0;

  await auditAdminEventSafe({
    req: reqForAudit,
    actor,
    action: 'pack.publish',
    entityType: 'StickerPack',
    entityId: String(pack._id),
    before: { isActive: wasActive },
    after: { isActive: true },
    meta: { stickersActivated },
  });

  return { pack, stickersActivated };
}

module.exports = { publishPack };
