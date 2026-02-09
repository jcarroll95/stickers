// apps/api/domain/users/userFields.js

/**
 * Pure allowlists for admin user CRUD.
 */

const CREATE_USER_FIELDS = ['name', 'email', 'role', 'password', 'isVerified', 'cheersStickers'];
const UPDATE_USER_FIELDS = ['name', 'email', 'role', 'isVerified', 'cheersStickers'];

/**
 * @param {object} body
 * @param {string[]} allowed
 * @returns {object}
 */
function pickAllowedFields(body, allowed) {
  const out = {};
  for (const f of allowed) {
    if (body?.[f] !== undefined) out[f] = body[f];
  }
  return out;
}

module.exports = { CREATE_USER_FIELDS, UPDATE_USER_FIELDS, pickAllowedFields };
