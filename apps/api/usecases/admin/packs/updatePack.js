// apps/api/usecases/admin/packs/updatePack.js

const StickerPack = require('../../../models/StickerPack');
const { emitAuditEvent } = require('../../../utils/audit');
const ErrorResponse = require('../../../utils/errorResponse');

const { diffFields } = require('../../../domain/admin/packs/diffFields');

async function updatePack({ actor, packId, updates, reqForAudit }) {
  const pack = await StickerPack.findById(packId);
  if (!pack) throw new ErrorResponse('Pack not found', 404);

  const before = { name: pack.name, description: pack.description };

  if (typeof updates?.name === 'string') pack.name = updates.name;
  if (typeof updates?.description === 'string') pack.description = updates.description;

  await pack.save();

  const after = { name: pack.name, description: pack.description };
  const changes = diffFields(before, after, ['name', 'description']);

  if (changes.length) {
    await emitAuditEvent(reqForAudit, {
      entityType: 'StickerPack',
      entityId: pack._id,
      action: 'pack.update',
      changes,
      meta: { packId: pack._id, actorUserId: actor?.id || null },
    });
  }

  return { pack };
}

module.exports = { updatePack };
