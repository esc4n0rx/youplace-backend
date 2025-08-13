const express = require('express');
const CreditController = require('../controllers/credit-controller');
const { authenticateToken } = require('../middlewares/auth-middleware');
const { auditMiddleware } = require('../middlewares/logging-middleware'); // NOVO
const { userActionMonitoring } = require('../middlewares/monitoring-middleware'); // NOVO

const router = express.Router();
const creditController = new CreditController();

// Obter créditos do usuário
router.get('/', 
  authenticateToken,
  creditController.getCredits
);

// Coletar bônus diário (com auditoria e monitoramento)
router.post('/daily-bonus', 
  authenticateToken,
  auditMiddleware('claim_daily_bonus'), // NOVO
  userActionMonitoring('claim_daily_bonus'), // NOVO
  creditController.claimDailyBonus
);

// Histórico de transações de crédito
router.get('/history', 
  authenticateToken,
  creditController.getCreditHistory
);

// Processar bônus diário para todos os usuários (endpoint admin/cron)
router.post('/process-daily-bonus', 
  // TODO: Adicionar middleware de autenticação de admin
  creditController.processDailyBonus
);

module.exports = router;