const UserLevelRepository = require('../../data/repositories/user-level-repository');
const PixelRepository = require('../../data/repositories/pixel-repository');
const LevelCalculator = require('../../shared/utils/level-calculator');
const { supabaseAdmin } = require('../../config/database');

class GamificationService {
  constructor() {
    this.userLevelRepository = new UserLevelRepository();
    this.pixelRepository = new PixelRepository();
    this.levelCalculator = new LevelCalculator();
  }

  async initializeUserLevel(userId) {
    // Verificar se usuário já tem nível
    const existingLevel = await this.userLevelRepository.findByUserId(userId);
    if (existingLevel) {
      return existingLevel;
    }

    // Contar pixels já pintados (para usuários existentes)
    const totalPixels = await this.pixelRepository.countPixelsByUser(userId);
    
    // Calcular estatísticas iniciais
    const stats = this.levelCalculator.calculateLevelStats(totalPixels);
    
    // Criar registro de nível
    const levelData = {
      userId,
      currentLevel: stats.currentLevel,
      totalPixelsPainted: stats.totalPixelsPainted,
      pixelsForCurrentLevel: stats.pixelsForCurrentLevel,
      pixelsForNextLevel: stats.pixelsForNextLevel,
      title: stats.title,
      experiencePoints: stats.experiencePoints,
      lastLevelUp: stats.currentLevel > 1 ? new Date() : null
    };

    return await this.userLevelRepository.create(levelData);
  }

  async updatePixelProgress(userId, pixelsAdded = 1) {
    // Buscar ou criar nível do usuário
    let userLevel = await this.userLevelRepository.findByUserId(userId);
    if (!userLevel) {
      userLevel = await this.initializeUserLevel(userId);
    }

    // Incrementar contagem de pixels
    const oldPixelCount = userLevel.totalPixelsPainted;
    const newPixelCount = oldPixelCount + pixelsAdded;

    // Verificar se houve level up
    const levelUpCheck = this.levelCalculator.checkLevelUp(oldPixelCount, newPixelCount);
    
    // Calcular novas estatísticas
    const newStats = this.levelCalculator.calculateLevelStats(newPixelCount);
    
    // Preparar dados para atualização
    const updateData = {
      currentLevel: newStats.currentLevel,
      totalPixelsPainted: newStats.totalPixelsPainted,
      pixelsForCurrentLevel: newStats.pixelsForCurrentLevel,
      pixelsForNextLevel: newStats.pixelsForNextLevel,
      title: newStats.title,
      experiencePoints: newStats.experiencePoints,
      lastLevelUp: levelUpCheck.leveledUp ? new Date() : userLevel.lastLevelUp
    };

    // Atualizar no banco
    const updatedLevel = await this.userLevelRepository.update(userId, updateData);

    // Retornar resultado com informações de level up
    return {
      userLevel: updatedLevel,
      levelUp: levelUpCheck.leveledUp ? {
        oldLevel: levelUpCheck.oldLevel,
        newLevel: levelUpCheck.newLevel,
        newTitle: newStats.title,
        levelsGained: levelUpCheck.levelsGained
      } : null
    };
  }

  async getUserLevel(userId) {
    let userLevel = await this.userLevelRepository.findByUserId(userId);
    
    if (!userLevel) {
      userLevel = await this.initializeUserLevel(userId);
    }

    return userLevel;
  }

  async getUserStats(userId) {
    const userLevel = await this.getUserLevel(userId);
    const ranking = await this.userLevelRepository.getUserRanking(userId);

    return {
      level: userLevel.toJSON(),
      ranking,
      // Estatísticas adicionais
      achievements: await this.getUserAchievements(userId),
      milestones: this.getNextMilestones(userLevel.currentLevel)
    };
  }

  async getLeaderboard(limit = 10) {
    return await this.userLevelRepository.getTopUsers(limit);
  }

  async getUserAchievements(userId) {
    // Sistema básico de conquistas baseado em níveis
    const userLevel = await this.getUserLevel(userId);
    const achievements = [];

    // Conquistas por marcos de nível
    const levelMilestones = [5, 10, 15, 20, 25, 30, 40, 50];
    
    levelMilestones.forEach(milestone => {
      if (userLevel.currentLevel >= milestone) {
        achievements.push({
          id: `level_${milestone}`,
          name: `Nível ${milestone} Alcançado`,
          description: `Chegou ao nível ${milestone} - ${this.levelCalculator.getTitleForLevel(milestone)}`,
          unlockedAt: userLevel.lastLevelUp,
          category: 'level'
        });
      }
    });

    // Conquistas por total de pixels
    const pixelMilestones = [100, 500, 1000, 5000, 10000, 25000, 50000];
    
    pixelMilestones.forEach(milestone => {
      if (userLevel.totalPixelsPainted >= milestone) {
        achievements.push({
          id: `pixels_${milestone}`,
          name: `${milestone.toLocaleString()} Pixels`,
          description: `Pintou ${milestone.toLocaleString()} pixels no mapa`,
          unlockedAt: userLevel.updatedAt,
          category: 'pixels'
        });
      }
    });

    return achievements;
  }

  getNextMilestones(currentLevel) {
    const milestones = [];
    
    // Próximos marcos de nível
    const levelTargets = [5, 10, 15, 20, 25, 30, 40, 50].filter(level => level > currentLevel);
    
    levelTargets.slice(0, 3).forEach(target => {
      const pixelsNeeded = this.levelCalculator.calculatePixelsForLevel(target);
      milestones.push({
        type: 'level',
        target,
        title: this.levelCalculator.getTitleForLevel(target),
        pixelsRequired: pixelsNeeded,
        description: `Alcance o nível ${target} para desbloquear o título "${this.levelCalculator.getTitleForLevel(target)}"`
      });
    });

    return milestones;
  }

  async getLevelStatistics() {
    return await this.userLevelRepository.getLevelStatistics();
  }

  // Método para recalcular todos os níveis (manutenção/migração)
  async recalculateAllLevels() {
    const { data: users } = await supabaseAdmin
      .from('users')
      .select('id');

    const results = [];

    for (const user of users) {
      try {
        const totalPixels = await this.pixelRepository.countPixelsByUser(user.id);
        const stats = this.levelCalculator.calculateLevelStats(totalPixels);
        
        // Atualizar ou criar nível
        let userLevel = await this.userLevelRepository.findByUserId(user.id);
        
        if (userLevel) {
          await this.userLevelRepository.update(user.id, stats);
        } else {
          await this.userLevelRepository.create({ userId: user.id, ...stats });
        }

        results.push({ userId: user.id, success: true, level: stats.currentLevel });
      } catch (error) {
        results.push({ userId: user.id, success: false, error: error.message });
      }
    }

    return results;
  }
}

module.exports = GamificationService;