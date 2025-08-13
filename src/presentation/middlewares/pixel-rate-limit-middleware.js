const rateLimit = require('express-rate-limit');

// Rate limit mais permissivo para pintura de pixels
const pixelPaintLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 60, // máximo 60 pixels por minuto por IP (1 por segundo)
  message: {
    success: false,
    error: 'Limite de velocidade excedido. Máximo 60 pixels por minuto.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limit ainda mais permissivo para burst ocasional
const pixelBurstLimit = rateLimit({
  windowMs: 10 * 1000, // 10 segundos
  max: 15, // máximo 15 pixels em 10 segundos
  message: {
    success: false,
    error: 'Pintura muito rápida. Máximo 15 pixels em 10 segundos.'
  }
});

// Rate limit para consultas de área (mais permissivo)
const areaQueryLimit = rateLimit({
  windowMs: 10 * 1000, // 10 segundos
  max: 50, // máximo 50 consultas por 10 segundos por IP
  message: {
    success: false,
    error: 'Muitas consultas de área. Tente novamente em alguns segundos.'
  }
});

// Rate limit para consulta de histórico
const historyQueryLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 100, // máximo 100 consultas por minuto por IP
  message: {
    success: false,
    error: 'Muitas consultas de histórico. Tente novamente em alguns segundos.'
  }
});

module.exports = {
  pixelPaintLimit,
  pixelBurstLimit,
  areaQueryLimit,
  historyQueryLimit
};