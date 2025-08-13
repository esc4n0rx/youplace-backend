const jwt = require('jsonwebtoken');
const { jwt: config } = require('../../config/environment');

const generateToken = (payload) => {
  return jwt.sign(payload, config.secret, {
    expiresIn: config.expiresIn
  });
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, config.secret);
  } catch (error) {
    throw new Error('Token inválido ou expirado');
  }
};

module.exports = {
  generateToken,
  verifyToken
};