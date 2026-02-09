const ErrorResponse = require('../../utils/errorResponse');

// Helper: basic email normalization
function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

// Helper: minimal validators (keep deps minimal)
function assertValidEmailAndPassword(email, password) {
  const e = String(email || '').trim();
  // Sanity-check email: no spaces, one "@", domain contains dot, TLD 2–63 letters.
  const emailRegex = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,63}$/;

  if (!e || !emailRegex.test(e)) {
    throw new ErrorResponse('Please provide a valid email address', 400);
  }

  if (!password || String(password).length < 6) {
    throw new ErrorResponse('Password must be at least 6 characters', 400);
  }
}

module.exports = { normalizeEmail, assertValidEmailAndPassword };
