const CreditService = require('../../domain/services/credit-service');

class CreditController {
  constructor() {
    this.creditService = new CreditService();
  }

  getCredits = async (req, res, next) => {
    try {
      const userId = req.user.userId;
      
      const credits = await this.creditService.getUserCredits(userId);

      res.status(200).json({
        success: true,
        data: {
          credits
        }
      });
    } catch (error) {
      next(error);
    }
  };

  claimDailyBonus = async (req, res, next) => {
    try {
      const userId = req.user.userId;
      
      const result = await this.creditService.claimDailyBonus(userId);

      res.status(200).json({
        success: true,
        message: 'Bônus diário coletado com sucesso',
        data: result
      });
    } catch (error) {
      next(error);
    }
  };

  getCreditHistory = async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const { limit } = req.query;

      const history = await this.creditService.getCreditHistory(
        userId, 
        limit ? parseInt(limit) : 20
      );

      res.status(200).json({
        success: true,
        data: {
          transactions: history.map(transaction => transaction.toJSON())
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // Endpoint para processar bônus diário (seria chamado por um cron job)
  processDailyBonus = async (req, res, next) => {
    try {
      // Verificar se tem permissão de admin (implementar validação adequada)
      const results = await this.creditService.processDailyBonusForAllUsers();

      res.status(200).json({
        success: true,
        message: 'Processamento de bônus diário concluído',
        data: {
          processed: results.length,
          results
        }
      });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = CreditController;