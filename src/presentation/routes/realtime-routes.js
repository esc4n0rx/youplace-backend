const express = require('express');
const rateLimit = require('express-rate-limit');
const RealtimeController = require('../controllers/realtime-controller');
const { authenticateToken } = require('../middlewares/auth-middleware');
const { requireAdmin } = require('../middlewares/admin-middleware');

const router = express.Router();
const realtimeController = new RealtimeController();

// Rate limiting para rotas de tempo real
const realtimeRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 30, // máximo 30 requests por minuto
  message: {
    success: false,
    error: 'Muitas requisições para tempo real. Tente novamente em alguns segundos.'
  }
});

router.use(realtimeRateLimit);

// === ROTAS PÚBLICAS ===

// Status do sistema de tempo real
router.get('/status', realtimeController.getStatus);

// Rooms ativos com estatísticas
router.get('/rooms/active', realtimeController.getActiveRooms);

// === ROTAS AUTENTICADAS ===

// Obter estado de um room específico
router.get('/rooms/:roomId/state',
  authenticateToken,
  realtimeController.getRoomState
);

// Obter estatísticas de um room
router.get('/rooms/:roomId/stats',
  authenticateToken,
  realtimeController.getRoomStats
);

// Calcular rooms para uma área (viewport)
router.get('/rooms/calculate',
  authenticateToken,
  realtimeController.calculateRoomsForViewport
);

// === ROTAS ADMINISTRATIVAS ===

// Estatísticas completas do sistema
router.get('/admin/stats',
  requireAdmin,
  realtimeController.getSystemStats
);

// Broadcast de evento especial
router.post('/admin/broadcast',
  requireAdmin,
  realtimeController.broadcastSpecialEvent
);

// Forçar limpeza do Redis
router.post('/admin/cleanup',
  requireAdmin,
  realtimeController.forceCleanup
);

module.exports = router;