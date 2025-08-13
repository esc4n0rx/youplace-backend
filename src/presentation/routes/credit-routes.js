const express = require('express');
const CreditController = require('../controllers/credit-controller');
const { authenticateToken } = require('../middlewares/auth-middleware');

const router = express.Router();
const creditController = new CreditController();

// Obter créditos do usuário
router.get('/', 
  authenticateToken,
  creditController.getCredits
);

// Coletar bônus diário
router.post('/daily-bonus', 
  authenticateToken,
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