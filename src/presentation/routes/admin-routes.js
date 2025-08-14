const express = require('express');
const rateLimit = require('express-rate-limit');
const AdminController = require('../controllers/admin-controller');
const { requireAdmin } = require('../middlewares/admin-middleware');
const { validateRequest } = require('../middlewares/validation-middleware');
const { auditMiddleware } = require('../middlewares/logging-middleware');
const { 
  adminActionSchema,
  banUserSchema,
  adjustCreditsSchema,
  getUsersSchema
} = require('../../shared/schemas/admin-schemas');

const router = express.Router();
const adminController = new AdminController();

// Rate limiting específico para ações administrativas
const adminRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 30, // máximo 30 ações por minuto
  message: {
    success: false,
    error: 'Muitas ações administrativas. Aguarde um momento.'
  }
});

// Rate limiting mais restritivo para ações críticas
const criticalActionLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minuto
  max: 10, // máximo 10 ações críticas por minuto
  message: {
    success: false,
    error: 'Limite de ações críticas excedido. Aguarde.'
  }
});

// Middleware comum para todas as rotas admin
router.use(adminRateLimit);
router.use(requireAdmin);

// === DASHBOARD E ESTATÍSTICAS ===

// Dashboard principal
router.get('/dashboard', adminController.getDashboard);

// === GESTÃO DE USUÁRIOS ===

// Listar usuários
router.get('/users',
  validateRequest(getUsersSchema, 'query'),
  adminController.getUsers
);

// Detalhes de um usuário específico
router.get('/users/:userId',
  adminController.getUserDetails
);

// === BANIMENTOS E SUSPENSÕES ===

// Banir usuário (permanente)
router.post('/users/:userId/ban',
  criticalActionLimit,
  auditMiddleware('admin_ban_user'),
  validateRequest(banUserSchema),
  adminController.banUser
);

// Suspender usuário (temporário)
router.post('/users/:userId/suspend',
  criticalActionLimit,
  auditMiddleware('admin_suspend_user'),
  validateRequest(banUserSchema),
  adminController.suspendUser
);

// Desbanir usuário
router.post('/users/:userId/unban',
  criticalActionLimit,
  auditMiddleware('admin_unban_user'),
  validateRequest(adminActionSchema),
  adminController.unbanUser
);

// === GESTÃO DE CRÉDITOS ===

// Ajustar créditos do usuário (adicionar ou remover)
router.post('/users/:userId/credits',
  auditMiddleware('admin_adjust_credits'),
  validateRequest(adjustCreditsSchema),
  adminController.adjustCredits
);

// === LOGS E AUDITORIA ===

// Listar ações administrativas
router.get('/actions',
  adminController.getAdminActions
);

// === RELATÓRIOS ===

// Gerar relatório de usuários
router.get('/reports/users',
  adminController.generateUserReport
);

// === VERIFICAÇÕES DE STATUS ===

// Verificar status de banimento de usuário
router.get('/check/user/:userId/ban-status',
  adminController.checkUserBanStatus
);

// Verificar status de banimento de IP
router.get('/check/ip/:ip/ban-status',
  adminController.checkIpBanStatus
);

module.exports = router;