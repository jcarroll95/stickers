// apps/api/domain/stix/stickFields.js

/**
 * Shared allowlists for Stick create/update.
 * Keep this in domain because it is pure policy and unit-testable.
 */

const STICK_ALLOWED_FIELDS = [
  'stickNumber',
  'stickMed',
  'stickLocation',
  'stickLocMod',
  'stickDose',
  'userTime',
  'userDate',
  'description',
  'nsv',
  'weight',
  'cost',
];

/**
 * Build stickData for create: includes belongsToBoard + user, and ignores empty strings.
 * @param {{ body: any, boardId: string, userId: string }} args
 * @returns {object}
 */
function buildStickCreateData({ body, boardId, userId }) {
  const stickData = { belongsToBoard: boardId, user: userId };

  for (const field of STICK_ALLOWED_FIELDS) {
    if (body?.[field] !== undefined && body[field] !== '') {
      stickData[field] = body[field];
    }
  }

  return stickData;
}

/**
 * Build updateData for update: allows clearing with "" -> null.
 * @param {{ body: any }} args
 * @returns {object}
 */
function buildStickUpdateData({ body }) {
  const updateData = {};
  for (const field of STICK_ALLOWED_FIELDS) {
    if (body?.[field] !== undefined) {
      updateData[field] = body[field] === '' ? null : body[field];
    }
  }
  return updateData;
}

module.exports = { STICK_ALLOWED_FIELDS, buildStickCreateData, buildStickUpdateData };
