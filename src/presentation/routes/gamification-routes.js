const express = require('express');
const GamificationController = require('../controllers/gamification-controller');
const { authenticateToken } = require('../middlewares/auth-middleware');

const router = express.Router();
const gamificationController = new GamificationController();

// Obter nível do usuário
router.get('/level', 
  authenticateToken,
  gamificationController.getUserLevel
);

// Obter estatísticas completas do usuário (nível + ranking + conquistas)
router.get('/stats', 
  authenticateToken,
  gamificationController.getUserStats
);

// Obter ranking geral
router.get('/leaderboard', 
  gamificationController.getLeaderboard
);

// Obter conquistas do usuário
router.get('/achievements', 
  authenticateToken,
  gamificationController.getUserAchievements
);

// Estatísticas gerais do sistema
router.get('/statistics', 
  gamificationController.getLevelStatistics
);

// Endpoint administrativo para recalcular níveis
router.post('/recalculate-levels', 
  // TODO: Adicionar middleware de autenticação de admin
  gamificationController.recalculateAllLevels
);

module.exports = router;