const GamificationService = require('../../domain/services/gamification-service');

class GamificationController {
  constructor() {
    this.gamificationService = new GamificationService();
  }

  getUserLevel = async (req, res, next) => {
    try {
      const userId = req.user.userId;
      
      const userLevel = await this.gamificationService.getUserLevel(userId);

      res.status(200).json({
        success: true,
        data: {
          level: userLevel.toJSON()
        }
      });
    } catch (error) {
      next(error);
    }
  };

  getUserStats = async (req, res, next) => {
    try {
      const userId = req.user.userId;
      
      const stats = await this.gamificationService.getUserStats(userId);

      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  };

  getLeaderboard = async (req, res, next) => {
    try {
      const { limit } = req.query;
      
      const leaderboard = await this.gamificationService.getLeaderboard(
        limit ? parseInt(limit) : 10
      );

      res.status(200).json({
        success: true,
        data: {
          leaderboard,
          lastUpdated: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  };

  getUserAchievements = async (req, res, next) => {
    try {
      const userId = req.user.userId;
      
      const achievements = await this.gamificationService.getUserAchievements(userId);

      res.status(200).json({
        success: true,
        data: {
          achievements,
          totalUnlocked: achievements.length
        }
      });
    } catch (error) {
      next(error);
    }
  };

  getLevelStatistics = async (req, res, next) => {
    try {
      const statistics = await this.gamificationService.getLevelStatistics();

      res.status(200).json({
        success: true,
        data: {
          statistics,
          totalLevels: statistics.length
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // Endpoint administrativo para recalcular níveis
  recalculateAllLevels = async (req, res, next) => {
    try {
      // TODO: Adicionar autenticação de admin
      const results = await this.gamificationService.recalculateAllLevels();

      const successful = results.filter(r => r.success).length;
      const failed = results.filter(r => !r.success).length;

      res.status(200).json({
        success: true,
        message: 'Recálculo de níveis concluído',
        data: {
          processed: results.length,
          successful,
          failed,
          results: results.slice(0, 10) // Primeiros 10 para debug
        }
      });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = GamificationController;