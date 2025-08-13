const PixelRepository = require('../../data/repositories/pixel-repository');
const CreditService = require('./credit-service');
const AntiBotService = require('./anti-bot-service');
const CoordinateSystem = require('../../shared/utils/coordinate-system');

class PixelService {
  constructor() {
    this.pixelRepository = new PixelRepository();
    this.creditService = new CreditService();
    this.antiBotService = new AntiBotService();
    this.coordinateSystem = new CoordinateSystem();
  }

  async paintPixel(userId, x, y, color, userCreatedAt = null) {
    // Validar coordenadas usando o sistema dinâmico
    if (!this.coordinateSystem.isValidPixelCoordinate(x, y)) {
      const bounds = this.coordinateSystem.getPixelBounds();
      throw new Error(
        `Coordenadas inválidas. Limites: X[${bounds.minX}, ${bounds.maxX}], Y[${bounds.minY}, ${bounds.maxY}]`
      );
    }

    // Validar cor hexadecimal
    if (!this.isValidColor(color)) {
      throw new Error('Cor inválida. Use formato hexadecimal #RRGGBB');
    }

    // Verificação anti-bot ANTES de debitar créditos
    try {
      const antiBotResult = await this.antiBotService.validatePixelPaint(
        userId, x, y, color, userCreatedAt
      );

      if (!antiBotResult.allowed) {
        throw new Error('Atividade suspeita detectada. Tente novamente mais tarde.');
      }

      // Log de warnings para monitoramento
      if (antiBotResult.warnings && antiBotResult.warnings.length > 0) {
        console.warn(`Warnings para usuário ${userId}:`, antiBotResult.warnings);
      }

      // Verificar e debitar créditos
      const hasCredits = await this.creditService.debitCredits(
        userId, 1, 'pixel_paint', `Pixel pintado em (${x},${y})`
      );
      
      if (!hasCredits) {
        throw new Error('Créditos insuficientes');
      }

      // Criar pixel
      const pixel = await this.pixelRepository.create({
        userId,
        x,
        y,
        color: color.toUpperCase()
      });

      // Log para análise se risk score alto
      if (antiBotResult.riskScore > 50) {
        console.warn(`Alto risk score (${antiBotResult.riskScore}) para usuário ${userId} - pixel ${x},${y}`);
      }

      return {
        pixel,
        riskScore: antiBotResult.riskScore,
        warnings: antiBotResult.warnings,
        geoCoordinates: this.coordinateSystem.pixelToGeo(x, y) // Incluir coordenadas geográficas
      };
    } catch (antiBotError) {
      // Se erro do anti-bot, não debitar créditos
      if (antiBotError.message.includes('suspeita') || antiBotError.message.includes('limite')) {
        throw antiBotError;
      }
      
      // Se outro erro, tentar continuar sem anti-bot (fallback)
      console.error('Erro no anti-bot service, continuando sem validação:', antiBotError);
      
      // Verificar e debitar créditos
      const hasCredits = await this.creditService.debitCredits(
        userId, 1, 'pixel_paint', `Pixel pintado em (${x},${y})`
      );
      
      if (!hasCredits) {
        throw new Error('Créditos insuficientes');
      }

      // Criar pixel
      try {
        const pixel = await this.pixelRepository.create({
          userId,
          x,
          y,
          color: color.toUpperCase()
        });

        return {
          pixel,
          riskScore: 0,
          warnings: ['Anti-bot service indisponível'],
          geoCoordinates: this.coordinateSystem.pixelToGeo(x, y)
        };
      } catch (error) {
        // Reverter débito em caso de erro
        await this.creditService.addCredits(
          userId, 1, 'admin_adjustment', 'Reversão por erro na pintura'
        );
        throw error;
      }
    }
  }

  async getPixelsByArea(minX, maxX, minY, maxY) {
    // Validar coordenadas
    if (!this.coordinateSystem.isValidPixelCoordinate(minX, minY) || 
        !this.coordinateSystem.isValidPixelCoordinate(maxX, maxY)) {
      throw new Error('Coordenadas da área inválidas');
    }

    // Validar se área não é muito grande (performance)
    if (!this.coordinateSystem.isValidSearchArea(minX, maxX, minY, maxY)) {
      throw new Error('Área muito grande para consulta. Máximo ~10.000 km²');
    }

    // Validar se área não tem muitos pixels (limite por número de pixels também)
    const pixelWidth = Math.abs(maxX - minX);
    const pixelHeight = Math.abs(maxY - minY);
    
    if (pixelWidth > 1000 || pixelHeight > 1000) {
      throw new Error('Área muito grande. Máximo 1000x1000 pixels por consulta');
    }

    return await this.pixelRepository.findByArea(minX, maxX, minY, maxY);
  }

  async getPixelInfo(x, y) {
    if (!this.isValidCoordinate(x, y)) {
      throw new Error('Coordenadas inválidas');
    }

    const pixel = await this.pixelRepository.getLatestByCoordinates(x, y);
    return pixel;
  }

  async getPixelHistory(x, y, limit = 10) {
    if (!this.isValidCoordinate(x, y)) {
      throw new Error('Coordenadas inválidas');
    }

    if (limit > 50) {
      throw new Error('Limite máximo de 50 registros por consulta');
    }

    return await this.pixelRepository.getPixelHistory(x, y, limit);
  }

  async getUserStats(userId, timeframe = '24h') {
    let since = null;
    
    if (timeframe === '24h') {
      since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    } else if (timeframe === '7d') {
      since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    }

    const count = await this.pixelRepository.countPixelsByUser(userId, since);
    return { pixelCount: count, timeframe };
  }

  isValidCoordinate(x, y) {
    // Validar se é número inteiro
    if (!Number.isInteger(x) || !Number.isInteger(y)) {
      return false;
    }

    // Validar ranges (assumindo mapa mundial em pixels)
    const MIN_X = -180000, MAX_X = 180000;
    const MIN_Y = -90000, MAX_Y = 90000;

    return x >= MIN_X && x <= MAX_X && y >= MIN_Y && y <= MAX_Y;
  }

  isValidColor(color) {
    return /^#[0-9A-F]{6}$/i.test(color);
  }
}

module.exports = PixelService;