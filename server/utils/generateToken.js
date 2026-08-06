const jwt = require('jsonwebtoken');

/**
 * ينشئ JWT token لمستخدم موظف أو قارئ.
 * @param {string} id - معرّف المستند في قاعدة البيانات.
 * @param {'staff'|'reader'} type - نوع الحساب.
 */
function generateToken(id, type) {
  return jwt.sign({ id, type }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d'
  });
}

module.exports = generateToken;
