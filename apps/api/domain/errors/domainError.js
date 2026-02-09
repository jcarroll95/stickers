// domain/errors/domainError.js

class DomainError extends Error {
  /**
   * @param {string} message
   * @param {number} statusCode - HTTP-ish status code used by app layer for translation
   */
  constructor(message, statusCode = 400) {
    super(message);
    this.name = 'DomainError';
    this.statusCode = statusCode;
  }
}

module.exports = { DomainError };
