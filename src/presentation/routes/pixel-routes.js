const express = require('express');
const PixelController = require('../controllers/pixel-controller');
const { authenticateToken } = require('../middlewares/auth-middleware');
const { validateRequest } = require('../middlewares/validation-middleware');
const { auditMiddleware } = require('../middlewares/logging-middleware'); // NOVO
const { performanceMonitoring } = require('../middlewares/monitoring-middleware'); // NOVO
const { 
  pixelPaintLimit, 
  pixelBurstLimit,
  areaQueryLimit, 
  historyQueryLimit 
} = require('../middlewares/pixel-rate-limit-middleware');
const { paintPixelSchema, getAreaPixelsSchema, pixelCoordinatesSchema } = require('../../shared/schemas/pixel-schemas');

const router = express.Router();
const pixelController = new PixelController();

// Pintar pixel (rate limiting em camadas + monitoramento)
router.post('/paint', 
  authenticateToken,
  pixelBurstLimit,
  pixelPaintLimit,
  auditMiddleware('paint_pixel'), // NOVO: Log de auditoria
  performanceMonitoring('paint_pixel'), // NOVO: Monitoramento de performance
  validateRequest(paintPixelSchema), 
  pixelController.paintPixel
);

// Buscar pixels por área (com monitoramento)
router.get('/area',
  areaQueryLimit,
  performanceMonitoring('area_query'), // NOVO
  validateRequest(getAreaPixelsSchema, 'query'),
  pixelController.getPixelsByArea
);

// Informações de um pixel específico
router.get('/:x/:y',
  validateRequest(pixelCoordinatesSchema, 'params'),
  pixelController.getPixelInfo
);

// Histórico de um pixel (com monitoramento)
router.get('/:x/:y/history',
  historyQueryLimit,
  performanceMonitoring('pixel_history'), // NOVO
  validateRequest(pixelCoordinatesSchema, 'params'),
  pixelController.getPixelHistory
);

// Estatísticas do usuário
router.get('/user/stats',
  authenticateToken,
  pixelController.getUserStats
);

module.exports = router;