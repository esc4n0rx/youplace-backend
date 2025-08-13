const express = require('express');
const rateLimit = require('express-rate-limit');
const MonitoringController = require('../controllers/monitoring-controller');
const { authenticateToken } = require('../middlewares/auth-middleware');

const router = express.Router();
const monitoringController = new MonitoringController();

// Rate limiting específico para rotas de monitoramento
const monitoringRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 30, // máximo 30 requests por minuto
  message: {
    success: false,
    error: 'Muitas requisições para monitoramento. Tente novamente em alguns segundos.'
  }
});

// Rate limiting mais restritivo para export de dados
const exportRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 5, // máximo 5 exports por minuto
  message: {
    success: false,
    error: 'Limite de export excedido. Aguarde 1 minuto.'
  }
});

// Middleware para verificar se é admin (TODO: implementar autenticação de admin)
const requireAdmin = (req, res, next) => {
  // Por enquanto, apenas verificar se está autenticado
  // Em produção, implementar verificação de papel de admin
  if (!req.user) {
    return res.status(403).json({
      success: false,
      error: 'Acesso negado. Permissões de administrador necessárias.'
    });
  }
  next();
};

// === ROTAS PÚBLICAS (apenas health) ===

// Health check básico
router.get('/health', monitoringController.getServiceHealth);

// === ROTAS AUTENTICADAS (admin) ===

// Dashboard principal
router.get('/dashboard', 
  monitoringRateLimit,
  authenticateToken,
  requireAdmin,
  monitoringController.getDashboard
);

// Status de saúde detalhado
router.get('/health/detailed', 
  monitoringRateLimit,
  authenticateToken,
  requireAdmin,
  monitoringController.getHealthStatus
);

// Métricas gerais
router.get('/metrics', 
  monitoringRateLimit,
  authenticateToken,
  requireAdmin,
  monitoringController.getMetrics
);

// Métricas em tempo real
router.get('/metrics/realtime', 
  monitoringRateLimit,
  authenticateToken,
  requireAdmin,
  monitoringController.getRealTimeMetrics
);

// === LOGS ===

// Logs do sistema
router.get('/logs', 
  monitoringRateLimit,
  authenticateToken,
  requireAdmin,
  monitoringController.getLogs
);

// Estatísticas de logs
router.get('/logs/statistics', 
  monitoringRateLimit,
  authenticateToken,
  requireAdmin,
  monitoringController.getLogStatistics
);

// Logs de erro
router.get('/logs/errors', 
  monitoringRateLimit,
  authenticateToken,
  requireAdmin,
  monitoringController.getErrorLogs
);

// Logs de segurança
router.get('/logs/security', 
  monitoringRateLimit,
  authenticateToken,
  requireAdmin,
  monitoringController.getSecurityLogs
);

// Requisições lentas
router.get('/logs/slow-requests', 
  monitoringRateLimit,
  authenticateToken,
  requireAdmin,
  monitoringController.getSlowRequests
);

// === ANÁLISES ===

// Endpoints mais acessados
router.get('/analytics/top-endpoints', 
  monitoringRateLimit,
  authenticateToken,
  requireAdmin,
  monitoringController.getTopEndpoints
);

// Estatísticas de usuários
router.get('/analytics/users', 
  monitoringRateLimit,
  authenticateToken,
  requireAdmin,
  monitoringController.getUserStats
);

// Alertas e eventos críticos
router.get('/alerts', 
  monitoringRateLimit,
  authenticateToken,
  requireAdmin,
  monitoringController.getAlerts
);

// === ADMINISTRAÇÃO ===

// Export de logs
router.get('/export/logs', 
  exportRateLimit,
  authenticateToken,
  requireAdmin,
  monitoringController.exportLogs
);

// Limpeza de dados antigos
router.post('/cleanup', 
  authenticateToken,
  requireAdmin,
  monitoringController.cleanupOldData
);

module.exports = router;