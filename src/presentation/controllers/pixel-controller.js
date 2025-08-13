const PixelService = require('../../domain/services/pixel-service');
const { userActionMonitoring, performanceMonitoring } = require('../middlewares/monitoring-middleware');

class PixelController {
  constructor() {
    this.pixelService = new PixelService();
  }

  paintPixel = async (req, res, next) => {
    // Aplicar monitoramento de performance e ação do usuário
    const performanceTimer = req.startPerformanceTimer ? req.startPerformanceTimer('pixel_validation') : null;
    await userActionMonitoring('paint_pixel')(req, res, () => {});
    
    try {
      const { x, y, color } = req.body;
      const userId = req.user.userId;

      // Timer para validação anti-bot
      if (performanceTimer && req.endPerformanceTimer) {
        await req.endPerformanceTimer(performanceTimer, 'pixel_validation');
      }

      const dbTimer = req.startPerformanceTimer ? req.startPerformanceTimer('pixel_creation') : null;
      
      const result = await this.pixelService.paintPixel(userId, x, y, color, req.user.createdAt);

      if (dbTimer && req.endPerformanceTimer) {
        await req.endPerformanceTimer(dbTimer, 'pixel_creation');
      }

      const response = {
        success: true,
        message: 'Pixel pintado com sucesso',
        data: {
          pixel: result.pixel.toJSON()
        }
      };

      // Incluir informações de level up se houver
      if (result.levelUp) {
        response.levelUp = result.levelUp;
        response.progress = result.progress;
      }

      // Incluir warnings se houver (para debug/monitoramento)
      if (result.warnings && result.warnings.length > 0) {
        response.warnings = result.warnings;
      }

      // Incluir risk score se alto (para monitoramento)
      if (result.riskScore > 30) {
        response.riskScore = result.riskScore;
      }

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  };

  getPixelsByArea = async (req, res, next) => {
    try {
      const { minX, maxX, minY, maxY } = req.query;

      const areaTimer = req.startPerformanceTimer ? req.startPerformanceTimer('area_query') : null;

      const pixels = await this.pixelService.getPixelsByArea(
        parseInt(minX),
        parseInt(maxX),
        parseInt(minY),
        parseInt(maxY)
      );

      if (areaTimer && req.endPerformanceTimer) {
        await req.endPerformanceTimer(areaTimer, 'area_query');
      }

      res.status(200).json({
        success: true,
        data: {
          pixels: pixels.map(pixel => pixel.toJSON()),
          count: pixels.length
        }
      });
    } catch (error) {
      next(error);
    }
  };

  getPixelInfo = async (req, res, next) => {
    try {
      const { x, y } = req.params;
      
      const pixel = await this.pixelService.getPixelInfo(parseInt(x), parseInt(y));

      if (!pixel) {
        return res.status(404).json({
          success: false,
          error: 'Nenhum pixel encontrado nesta posição'
        });
      }

      res.status(200).json({
        success: true,
        data: {
          pixel: pixel.toJSON()
        }
      });
    } catch (error) {
      next(error);
    }
  };

  getPixelHistory = async (req, res, next) => {
    try {
      const { x, y } = req.params;
      const { limit } = req.query;

      const history = await this.pixelService.getPixelHistory(
        parseInt(x), 
        parseInt(y), 
        limit ? parseInt(limit) : 10
      );

      res.status(200).json({
        success: true,
        data: {
          history: history.map(pixel => pixel.toJSON()),
          coordinates: { x: parseInt(x), y: parseInt(y) }
        }
      });
    } catch (error) {
      next(error);
    }
  };

  getUserStats = async (req, res, next) => {
    try {
      const userId = req.user.userId;
      const { timeframe } = req.query;

      const stats = await this.pixelService.getUserStats(userId, timeframe);

      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = PixelController;