class LevelCalculator {
    constructor() {
      // Sistema expandido de títulos para 1000 níveis
      // Distribuição estratégica: títulos únicos em marcos importantes
      this.levelTitles = {
        // === FASE EXPLORADOR (1-50) ===
        1: 'Explorador Iniciante',
        5: 'Viajante Curioso',
        10: 'Navegador Urbano',
        15: 'Mapeador Novato',
        20: 'Descobridor Regional',
        25: 'Aventureiro Continental',
        30: 'Cartógrafo Experiente',
        35: 'Explorador Intercontinental',
        40: 'Navegador dos Oceanos',
        45: 'Mestre dos Territórios',
        50: 'Pioneiro das Fronteiras',
  
        // === FASE CARTÓGRAFO (51-150) ===
        60: 'Conquistador de Hemisférios',
        70: 'Guardião dos Meridianos',
        80: 'Senhor dos Paralelos',
        90: 'Domador de Coordenadas',
        100: 'Arquiteto de Mundos',
        110: 'Tecelão de Paisagens',
        120: 'Pintor de Continentes',
        130: 'Escultor Geográfico',
        140: 'Artista Planetário',
        150: 'Visionário Cartográfico',
  
        // === FASE MESTRE (151-300) ===
        175: 'Mago da Cartografia',
        200: 'Oráculo dos Mapas',
        225: 'Profeta das Descobertas',
        250: 'Xamã Territorial',
        275: 'Guardião Dimensional',
        300: 'Imperador dos Pixels',
  
        // === FASE LENDA (301-600) ===
        325: 'Soberano Geoespacial',
        350: 'Divindade Cartográfica',
        375: 'Criador de Realidades',
        400: 'Arquiteto do Infinito',
        450: 'Transcendente Geográfico',
        500: 'Entidade Multidimensional',
        550: 'Deus dos Mapas Eternos',
        600: 'Onipresença Territorial',
  
        // === FASE DIVINDADE (601-1000) ===
        650: 'Avatar da Criação',
        700: 'Consciência Planetária',
        750: 'Força Primordial',
        800: 'Essência do Cosmos',
        850: 'Infinitude Pixelizada',
        900: 'Origem de Todos os Mapas',
        950: 'Transcendência Absoluta',
        1000: 'O Criador Supremo'
      };
  
      // Cache otimizado para 1000 níveis
      this.pixelRequirementsCache = new Map();
      this.levelFromPixelsCache = new Map();
      
      // Pre-calcular alguns valores críticos
      this.precalculateKeyLevels();
    }
  
    // Pre-calcular níveis importantes para otimização
    precalculateKeyLevels() {
      const keyLevels = [1, 10, 25, 50, 100, 200, 300, 500, 750, 1000];
      keyLevels.forEach(level => {
        this.calculatePixelsForLevel(level);
      });
    }
  
    // Calcular pixels necessários para um nível específico com nova progressão
    calculatePixelsForLevel(level) {
      if (this.pixelRequirementsCache.has(level)) {
        return this.pixelRequirementsCache.get(level);
      }
  
      let pixels;
  
      if (level <= 1) {
        pixels = 0; // Nível 1 não requer pixels
      } else if (level <= 10) {
        // Progressão linear inicial muito suave
        const linearBase = [0, 5, 15, 30, 50, 75, 105, 140, 180, 225, 275];
        pixels = linearBase[level - 1] || 0;
      } else if (level <= 50) {
        // Progressão quadrática moderada (níveis 11-50)
        const baseLevel10 = 275;
        const quadraticFactor = Math.pow(level - 10, 1.8);
        pixels = Math.floor(baseLevel10 + (quadraticFactor * 8));
      } else if (level <= 200) {
        // Progressão exponencial moderada (níveis 51-200)
        const baseLevel50 = this.calculatePixelsForLevel(50);
        const exponentialFactor = Math.pow(1.15, level - 50);
        pixels = Math.floor(baseLevel50 * exponentialFactor);
      } else if (level <= 500) {
        // Progressão exponencial mais suave (níveis 201-500)
        const baseLevel200 = this.calculatePixelsForLevel(200);
        const exponentialFactor = Math.pow(1.12, level - 200);
        pixels = Math.floor(baseLevel200 * exponentialFactor);
      } else if (level <= 1000) {
        // Progressão exponencial muito suave para níveis épicos (501-1000)
        const baseLevel500 = this.calculatePixelsForLevel(500);
        const exponentialFactor = Math.pow(1.08, level - 500);
        pixels = Math.floor(baseLevel500 * exponentialFactor);
      } else {
        // Níveis além de 1000 (caso extremo)
        const baseLevel1000 = this.calculatePixelsForLevel(1000);
        const exponentialFactor = Math.pow(1.05, level - 1000);
        pixels = Math.floor(baseLevel1000 * exponentialFactor);
      }
  
      this.pixelRequirementsCache.set(level, pixels);
      return pixels;
    }
  
    // Calcular nível baseado no total de pixels pintados (otimizado para 1000 níveis)
    calculateLevelFromPixels(totalPixels) {
      // Cache para evitar recálculos
      const cacheKey = Math.floor(totalPixels / 100) * 100; // Cache por centenas
      if (this.levelFromPixelsCache.has(cacheKey)) {
        const cachedLevel = this.levelFromPixelsCache.get(cacheKey);
        // Refinar a partir do cache
        return this.refineLevelCalculation(totalPixels, cachedLevel);
      }
  
      let level = 1;
      const maxLevel = 1000;
  
      // Busca binária otimizada
      let low = 1, high = maxLevel;
      
      while (low <= high) {
        let mid = Math.floor((low + high) / 2);
        let requiredPixels = this.calculatePixelsForLevel(mid);
        let nextLevelPixels = this.calculatePixelsForLevel(mid + 1);
  
        if (totalPixels >= requiredPixels && totalPixels < nextLevelPixels) {
          level = mid;
          break;
        } else if (totalPixels >= nextLevelPixels) {
          low = mid + 1;
        } else {
          high = mid - 1;
        }
      }
  
      // Cachear resultado
      this.levelFromPixelsCache.set(cacheKey, level);
      return Math.min(level, maxLevel);
    }
  
    // Refinamento para cálculos precisos próximos ao cache
    refineLevelCalculation(totalPixels, approximateLevel) {
      const searchRange = 10;
      const start = Math.max(1, approximateLevel - searchRange);
      const end = Math.min(1000, approximateLevel + searchRange);
  
      for (let level = start; level <= end; level++) {
        const requiredPixels = this.calculatePixelsForLevel(level);
        const nextLevelPixels = this.calculatePixelsForLevel(level + 1);
        
        if (totalPixels >= requiredPixels && totalPixels < nextLevelPixels) {
          return level;
        }
      }
  
      return approximateLevel;
    }
  
    // Obter título para um nível (melhorado para 1000 níveis)
    getTitleForLevel(level) {
      // Título específico se existir
      if (this.levelTitles[level]) {
        return this.levelTitles[level];
      }
  
      // Sistema de interpolação melhorado
      const availableLevels = Object.keys(this.levelTitles)
        .map(Number)
        .sort((a, b) => a - b);
  
      // Encontrar o título anterior mais próximo
      let bestMatch = 1;
      for (let i = 0; i < availableLevels.length; i++) {
        if (availableLevels[i] <= level) {
          bestMatch = availableLevels[i];
        } else {
          break;
        }
      }
  
      // Adicionar sufixo baseado na distância do marco
      const baseTitle = this.levelTitles[bestMatch];
      const distance = level - bestMatch;
      
      if (distance === 0) {
        return baseTitle;
      } else if (distance <= 5) {
        return `${baseTitle} Aprimorado`;
      } else if (distance <= 15) {
        return `${baseTitle} Avançado`;
      } else if (distance <= 30) {
        return `${baseTitle} Supremo`;
      } else {
        return `${baseTitle} Transcendente`;
      }
    }
  
    // Calcular estatísticas completas de progresso
    calculateLevelStats(totalPixels) {
      const currentLevel = this.calculateLevelFromPixels(totalPixels);
      const currentLevelRequirement = this.calculatePixelsForLevel(currentLevel);
      const nextLevelRequirement = this.calculatePixelsForLevel(currentLevel + 1);
      
      const pixelsForCurrentLevel = totalPixels - currentLevelRequirement;
      const pixelsForNextLevel = nextLevelRequirement - currentLevelRequirement;
      
      return {
        currentLevel,
        totalPixelsPainted: totalPixels,
        pixelsForCurrentLevel,
        pixelsForNextLevel,
        title: this.getTitleForLevel(currentLevel),
        experiencePoints: totalPixels,
        progressPercentage: pixelsForNextLevel > 0 ? 
          Math.round((pixelsForCurrentLevel / pixelsForNextLevel) * 100) : 100,
        pixelsUntilNextLevel: Math.max(0, pixelsForNextLevel - pixelsForCurrentLevel),
        // Estatísticas adicionais para níveis altos
        levelPhase: this.getLevelPhase(currentLevel),
        estimatedTimeToNextLevel: this.estimateTimeToNextLevel(pixelsForCurrentLevel, pixelsForNextLevel),
        percentageToMaxLevel: this.getPercentageToMaxLevel(totalPixels)
      };
    }
  
    // Determinar a fase do nível para contexto
    getLevelPhase(level) {
      if (level <= 50) return { name: 'Explorador', color: '#4CAF50', description: 'Descobrindo o mundo' };
      if (level <= 150) return { name: 'Cartógrafo', color: '#2196F3', description: 'Mapeando territórios' };
      if (level <= 300) return { name: 'Mestre', color: '#9C27B0', description: 'Dominando a arte' };
      if (level <= 600) return { name: 'Lenda', color: '#FF9800', description: 'Transcendendo limites' };
      return { name: 'Divindade', color: '#F44336', description: 'Poder absoluto' };
    }
  
    // Estimar tempo para próximo nível (baseado em 250 pixels/dia)
    estimateTimeToNextLevel(pixelsForCurrentLevel, pixelsForNextLevel) {
      const pixelsRemaining = pixelsForNextLevel - pixelsForCurrentLevel;
      const dailyPixelRate = 250; // Créditos diários
      const daysToNextLevel = Math.ceil(pixelsRemaining / dailyPixelRate);
      
      if (daysToNextLevel <= 1) return 'Menos de 1 dia';
      if (daysToNextLevel <= 7) return `${daysToNextLevel} dias`;
      if (daysToNextLevel <= 30) return `${Math.ceil(daysToNextLevel / 7)} semanas`;
      if (daysToNextLevel <= 365) return `${Math.ceil(daysToNextLevel / 30)} meses`;
      return `${Math.ceil(daysToNextLevel / 365)} anos`;
    }
  
    // Calcular progresso até o nível máximo
    getPercentageToMaxLevel(totalPixels) {
      const maxLevelPixels = this.calculatePixelsForLevel(1000);
      return Math.min(100, (totalPixels / maxLevelPixels) * 100);
    }
  
    // Verificar se houve level up
    checkLevelUp(oldPixels, newPixels) {
      const oldLevel = this.calculateLevelFromPixels(oldPixels);
      const newLevel = this.calculateLevelFromPixels(newPixels);
      
      return {
        leveledUp: newLevel > oldLevel,
        oldLevel,
        newLevel,
        levelsGained: newLevel - oldLevel,
        isSignificantLevelUp: this.isSignificantLevel(newLevel),
        phaseChanged: this.getLevelPhase(oldLevel).name !== this.getLevelPhase(newLevel).name
      };
    }
  
    // Verificar se é um nível significativo (com título único)
    isSignificantLevel(level) {
      return this.levelTitles.hasOwnProperty(level);
    }
  
    // Obter próximos marcos importantes
    getNextMilestones(currentLevel, count = 3) {
      const milestones = [];
      const titleLevels = Object.keys(this.levelTitles)
        .map(Number)
        .filter(level => level > currentLevel)
        .sort((a, b) => a - b);
      
      titleLevels.slice(0, count).forEach(level => {
        const pixelsNeeded = this.calculatePixelsForLevel(level);
        const phase = this.getLevelPhase(level);
        
        milestones.push({
          type: 'level',
          target: level,
          title: this.levelTitles[level],
          pixelsRequired: pixelsNeeded,
          phase: phase.name,
          description: `Alcance o nível ${level} para desbloquear "${this.levelTitles[level]}"`,
          estimatedTime: this.estimateTimeToLevel(currentLevel, level)
        });
      });
  
      return milestones;
    }
  
    // Estimar tempo para alcançar um nível específico
    estimateTimeToLevel(currentLevel, targetLevel) {
      const currentPixels = this.calculatePixelsForLevel(currentLevel);
      const targetPixels = this.calculatePixelsForLevel(targetLevel);
      const pixelsNeeded = targetPixels - currentPixels;
      const dailyRate = 250;
      const days = Math.ceil(pixelsNeeded / dailyRate);
      
      if (days <= 30) return `~${days} dias`;
      if (days <= 365) return `~${Math.ceil(days / 30)} meses`;
      return `~${Math.ceil(days / 365)} anos`;
    }
  
    // Obter estatísticas de progresso detalhadas
    getProgressionStats() {
      const stats = {
        maxLevel: 1000,
        totalTitles: Object.keys(this.levelTitles).length,
        phases: [
          { name: 'Explorador', levels: '1-50', focus: 'Aprendizado básico' },
          { name: 'Cartógrafo', levels: '51-150', focus: 'Desenvolvimento de habilidades' },
          { name: 'Mestre', levels: '151-300', focus: 'Domínio avançado' },
          { name: 'Lenda', levels: '301-600', focus: 'Conquistas épicas' },
          { name: 'Divindade', levels: '601-1000', focus: 'Transcendência' }
        ],
        pixelsToMaxLevel: this.calculatePixelsForLevel(1000),
        estimatedTimeToMaxLevel: this.estimateTimeToLevel(1, 1000)
      };
  
      return stats;
    }
  
    // Obter todos os títulos disponíveis organizados
    getAllTitles() {
      return {
        titles: this.levelTitles,
        byPhase: {
          explorador: this.getTitlesByPhase(1, 50),
          cartografo: this.getTitlesByPhase(51, 150),
          mestre: this.getTitlesByPhase(151, 300),
          lenda: this.getTitlesByPhase(301, 600),
          divindade: this.getTitlesByPhase(601, 1000)
        }
      };
    }
  
    // Obter títulos por fase
    getTitlesByPhase(minLevel, maxLevel) {
      const phaseTitles = {};
      Object.keys(this.levelTitles).forEach(level => {
        const numLevel = parseInt(level);
        if (numLevel >= minLevel && numLevel <= maxLevel) {
          phaseTitles[level] = this.levelTitles[level];
        }
      });
      return phaseTitles;
    }
  
    // Limpar todos os caches
    clearCache() {
      this.pixelRequirementsCache.clear();
      this.levelFromPixelsCache.clear();
    }
  
    // Método de debug para testar progressão
    debugProgression(levels = [1, 10, 50, 100, 200, 500, 1000]) {
      console.log('📊 PROGRESSÃO DE NÍVEIS DEBUG:');
      console.log('═'.repeat(80));
      
      levels.forEach(level => {
        const pixels = this.calculatePixelsForLevel(level);
        const title = this.getTitleForLevel(level);
        const phase = this.getLevelPhase(level);
        const timeEstimate = level > 1 ? this.estimateTimeToLevel(1, level) : 'Inicial';
        
        console.log(`Nível ${level.toString().padStart(4)}: ${pixels.toLocaleString().padStart(15)} pixels | ${title.padEnd(30)} | ${phase.name.padEnd(12)} | ${timeEstimate}`);
      });
      
      console.log('═'.repeat(80));
      console.log(`Total para nível 1000: ${this.calculatePixelsForLevel(1000).toLocaleString()} pixels`);
      console.log(`Estimativa: ${this.estimateTimeToLevel(1, 1000)} para jogador dedicado`);
    }
  }
  
  module.exports = LevelCalculator;