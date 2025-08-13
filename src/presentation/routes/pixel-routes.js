const express = require('express');
const PixelController = require('../controllers/pixel-controller');
const { authenticateToken } = require('../middlewares/auth-middleware');
const { validateRequest } = require('../middlewares/validation-middleware');
const { 
  pixelPaintLimit, 
  pixelBurstLimit,
  areaQueryLimit, 
  historyQueryLimit 
} = require('../middlewares/pixel-rate-limit-middleware');
const { paintPixelSchema, getAreaPixelsSchema, pixelCoordinatesSchema } = require('../../shared/schemas/pixel-schemas');

const router = express.Router();
const pixelController = new PixelController();

// Pintar pixel (rate limiting em camadas)
router.post('/paint', 
  authenticateToken,
  pixelBurstLimit,    // Primeiro limite: burst
  pixelPaintLimit,    // Segundo limite: sustentado
  validateRequest(paintPixelSchema), 
  pixelController.paintPixel
);

// Buscar pixels por área
router.get('/area',
  areaQueryLimit,
  validateRequest(getAreaPixelsSchema, 'query'),
  pixelController.getPixelsByArea
);

// Informações de um pixel específico
router.get('/:x/:y',
  validateRequest(pixelCoordinatesSchema, 'params'),
  pixelController.getPixelInfo
);

// Histórico de um pixel
router.get('/:x/:y/history',
  historyQueryLimit,
  validateRequest(pixelCoordinatesSchema, 'params'),
  pixelController.getPixelHistory
);

// Estatísticas do usuário
router.get('/user/stats',
  authenticateToken,
  pixelController.getUserStats
);

module.exports = router;