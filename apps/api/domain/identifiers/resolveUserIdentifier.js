function isMongoObjectIdLike(value) {
  return typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

module.exports = { isMongoObjectIdLike, normalizeEmail };
