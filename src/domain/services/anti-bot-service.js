const PixelRepository = require('../../data/repositories/pixel-repository');

class AntiBotService {
  constructor() {
    this.pixelRepository = new PixelRepository();
    
    // Configurações otimizadas baseadas nos testes
    this.config = {
      // Velocidade máxima considerada humana
      maxPixelsPerSecond: 2,
      maxPixelsPerMinute: 80, // Aumentado para permitir uso intenso mas humano
      maxPixelsPerHour: 1500,
      
      // Detecção de burst (rajada) - mais permissiva para uso normal
      burstWindow: 10, // segundos
      maxBurstPixels: 25, // Aumentado um pouco
      
      // Detecção de padrões suspeitos
      maxLinearSequence: 12, // Reduzido para ser menos restritivo
      maxIdenticalColors: 40, // Aumentado
      
      // Sistema de cooldown/recuperação
      cooldownAfterBlock: 30, // 30 segundos ao invés de muito tempo
      warningBeforeBlock: true, // Dar warning antes de bloquear
    };
    
    // Cache para rastreamento de usuários bloqueados
    this.userBlocks = new Map();
  }

  async validatePixelPaint(userId, x, y, color, userCreatedAt) {
    try {
      // Verificar se usuário está em cooldown
      if (this.isUserInCooldown(userId)) {
        const remainingTime = this.getRemainingCooldown(userId);
        throw new Error(`Aguarde ${remainingTime}s antes de pintar novamente`);
      }

      const validations = await Promise.all([
        this.checkBurstActivity(userId),
        this.checkSpeedLimits(userId),
        this.checkBasicPatterns(userId, x, y, color)
      ]);

      const failed = validations.filter(v => !v.passed);
      const highSeverityFails = failed.filter(f => f.severity === 'high');
      
      // Se falhou em validação de alta severidade, bloquear imediatamente
      if (highSeverityFails.length > 0) {
        this.setUserCooldown(userId);
        throw new Error(`Atividade suspeita detectada: ${highSeverityFails[0].reason}`);
      }
      
      // Se falhou em múltiplas validações médias/baixas, dar warning
      if (failed.length >= 2) {
        this.incrementUserWarnings(userId);
        const userWarnings = this.getUserWarnings(userId);
        
        if (userWarnings >= 3) {
          this.setUserCooldown(userId);
          throw new Error('Múltiplas atividades suspeitas. Cooldown aplicado.');
        }
      }
      
      return {
        allowed: true,
        warnings: failed.map(f => f.reason),
        riskScore: this.calculateRiskScore(validations),
        warningsCount: this.getUserWarnings(userId)
      };
    } catch (error) {
      if (error.message.includes('suspeita') || error.message.includes('Aguarde')) {
        throw error;
      }
      
      console.error('Erro no anti-bot service:', error);
      return {
        allowed: true,
        warnings: ['Sistema anti-bot com erro'],
        riskScore: 0
      };
    }
  }

  async checkBurstActivity(userId) {
    try {
      const burstStart = new Date(Date.now() - this.config.burstWindow * 1000);
      const recentPixels = await this.pixelRepository.countPixelsByUser(userId, burstStart);
      
      if (recentPixels > this.config.maxBurstPixels) {
        return {
          passed: false,
          reason: `Burst detectado: ${recentPixels} pixels em ${this.config.burstWindow}s`,
          severity: 'high'
        };
      }

      return { passed: true };
    } catch (error) {
      console.error('Erro no checkBurstActivity:', error);
      return { passed: true };
    }
  }

  async checkSpeedLimits(userId) {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
      const threeSecondsAgo = new Date(Date.now() - 3 * 1000);

      const [hourlyPixels, minutePixels, recentPixels] = await Promise.all([
        this.pixelRepository.countPixelsByUser(userId, oneHourAgo),
        this.pixelRepository.countPixelsByUser(userId, oneMinuteAgo),
        this.pixelRepository.countPixelsByUser(userId, threeSecondsAgo)
      ]);

      // Verificar limite por 3 segundos (mais permissivo)
      if (recentPixels > this.config.maxPixelsPerSecond * 3) {
        return {
          passed: false,
          reason: `Velocidade excessiva: ${recentPixels} pixels em 3s`,
          severity: 'high'
        };
      }

      // Verificar limite por minuto
      if (minutePixels > this.config.maxPixelsPerMinute) {
        return {
          passed: false,
          reason: `Limite por minuto: ${minutePixels}/${this.config.maxPixelsPerMinute}`,
          severity: 'medium'
        };
      }

      // Verificar limite por hora
      if (hourlyPixels > this.config.maxPixelsPerHour) {
        return {
          passed: false,
          reason: `Limite por hora: ${hourlyPixels}/${this.config.maxPixelsPerHour}`,
          severity: 'low'
        };
      }

      return { passed: true };
    } catch (error) {
      console.error('Erro no checkSpeedLimits:', error);
      return { passed: true };
    }
  }

  async checkBasicPatterns(userId, x, y, color) {
    try {
      const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000); // Reduzido para 2 minutos
      const recentPixels = await this.pixelRepository.getRecentPixelsByUser(userId, twoMinutesAgo);

      // Verificar mesma cor repetida (mais permissivo)
      const sameColorCount = recentPixels.filter(p => p.color === color).length;
      if (sameColorCount > this.config.maxIdenticalColors) {
        return {
          passed: false,
          reason: `Muitos pixels da mesma cor: ${sameColorCount}`,
          severity: 'low'
        };
      }

      // Verificar sequência linear
      if (recentPixels.length >= 3) {
        const linearSequence = this.detectSimpleLinearSequence(recentPixels, { x, y });
        if (linearSequence > this.config.maxLinearSequence) {
          return {
            passed: false,
            reason: `Padrão linear detectado: ${linearSequence} pixels`,
            severity: 'medium'
          };
        }
      }

      return { passed: true };
    } catch (error) {
      console.error('Erro no checkBasicPatterns:', error);
      return { passed: true };
    }
  }

  // Gerenciamento de cooldown e warnings
  isUserInCooldown(userId) {
    const userBlock = this.userBlocks.get(userId);
    if (!userBlock || !userBlock.cooldownUntil) return false;
    
    return Date.now() < userBlock.cooldownUntil;
  }

  getRemainingCooldown(userId) {
    const userBlock = this.userBlocks.get(userId);
    if (!userBlock || !userBlock.cooldownUntil) return 0;
    
    return Math.ceil((userBlock.cooldownUntil - Date.now()) / 1000);
  }

  setUserCooldown(userId) {
    const userBlock = this.userBlocks.get(userId) || { warnings: 0 };
    userBlock.cooldownUntil = Date.now() + (this.config.cooldownAfterBlock * 1000);
    userBlock.warnings = 0; // Reset warnings após cooldown
    this.userBlocks.set(userId, userBlock);
    
    console.log(`Usuário ${userId} em cooldown por ${this.config.cooldownAfterBlock}s`);
  }

  incrementUserWarnings(userId) {
    const userBlock = this.userBlocks.get(userId) || { warnings: 0 };
    userBlock.warnings++;
    this.userBlocks.set(userId, userBlock);
  }

  getUserWarnings(userId) {
    const userBlock = this.userBlocks.get(userId);
    return userBlock ? userBlock.warnings : 0;
  }

  detectSimpleLinearSequence(recentPixels, newPixel) {
    if (recentPixels.length < 3) return 0;

    // Verificar apenas os últimos pixels para padrão linear
    const lastPixels = [...recentPixels.slice(-8), newPixel]; // Últimos 8 + novo
    let maxLinearCount = 1;
    let currentLinearCount = 1;

    for (let i = 1; i < lastPixels.length; i++) {
      const prev = lastPixels[i - 1];
      const curr = lastPixels[i];
      
      // Verificar se forma linha reta (horizontal, vertical ou diagonal)
      const dx = curr.x - prev.x;
      const dy = curr.y - prev.y;
      
      // Linha reta se dx e dy são consistentes
      if (i >= 2) {
        const prevPrev = lastPixels[i - 2];
        const prevDx = prev.x - prevPrev.x;
        const prevDy = prev.y - prevPrev.y;
        
        if (dx === prevDx && dy === prevDy && (Math.abs(dx) <= 1 && Math.abs(dy) <= 1)) {
          currentLinearCount++;
        } else {
          maxLinearCount = Math.max(maxLinearCount, currentLinearCount);
          currentLinearCount = 1;
        }
      }
    }

    return Math.max(maxLinearCount, currentLinearCount);
  }

  calculateRiskScore(validations) {
    const failedValidations = validations.filter(v => !v.passed);
    const severityWeights = { high: 4, medium: 2, low: 1 };
    
    const totalWeight = failedValidations.reduce((sum, f) => 
      sum + (severityWeights[f.severity] || 1), 0
    );

    return Math.min(100, totalWeight * 12);
  }

  // Método para limpar dados antigos (deveria ser chamado periodicamente)
  cleanupOldData() {
    const now = Date.now();
    for (const [userId, userBlock] of this.userBlocks.entries()) {
      // Remover cooldowns expirados há mais de 1 hora
      if (userBlock.cooldownUntil && (now - userBlock.cooldownUntil) > 3600000) {
        this.userBlocks.delete(userId);
      }
    }
  }
}

module.exports = AntiBotService;