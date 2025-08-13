const LogRepository = require('../../data/repositories/log-repository');
const logger = require('../../config/logger');

class LoggingService {
  constructor() {
    this.logRepository = new LogRepository();
  }

  async createLog(logData) {
    try {
      // Validar dados essenciais
      if (!logData.level || !logData.message) {
        throw new Error('Level e message são obrigatórios');
      }

      // Salvar no banco (assíncrono, não-bloqueante)
      setImmediate(async () => {
        try {
          await this.logRepository.create(logData);
        } catch (error) {
          console.error('Falha ao salvar log no banco:', error);
        }
      });

      // Log imediato no Winston
      logger[logData.level] ? 
        logger[logData.level](logData.message, logData) :
        logger.info(logData.message, logData);

      return true;
    } catch (error) {
      console.error('Erro no LoggingService:', error);
      return false;
    }
  }

  async getRecentLogs(options = {}) {
    const {
      limit = 100,
      level = null,
      type = null,
      userId = null,
      endpoint = null,
      since = null,
      until = null
    } = options;

    const filters = {};
    if (level) filters.level = level;
    if (type) filters.type = type;
    if (userId) filters.userId = userId;
    if (endpoint) filters.endpoint = endpoint;
    if (since) filters.since = since;
    if (until) filters.until = until;

    return await this.logRepository.findRecent(limit, filters);
  }

  async getLogStatistics(since = null) {
    const defaultSince = since || new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [levelCounts, typeCounts, errorLogs, securityLogs, slowRequests, topEndpoints] = 
      await Promise.all([
        this.logRepository.countByLevel(defaultSince),
        this.logRepository.countByType(defaultSince),
        this.logRepository.getErrorLogs(20, defaultSince),
        this.logRepository.getSecurityLogs(10, defaultSince),
        this.logRepository.getSlowRequests(1000, 20),
        this.logRepository.getTopEndpoints(10, defaultSince)
      ]);

    return {
      period: since ? `desde ${since.toISOString()}` : 'últimas 24h',
      summary: {
        byLevel: levelCounts,
        byType: typeCounts,
        totalErrors: errorLogs.length,
        totalSecurityEvents: securityLogs.length,
        slowRequestsCount: slowRequests.length
      },
      details: {
        recentErrors: errorLogs.slice(0, 10).map(log => log.toJSON()),
        securityEvents: securityLogs.map(log => log.toJSON()),
        slowestRequests: slowRequests.slice(0, 10).map(log => log.toJSON()),
        topEndpoints: topEndpoints
      }
    };
  }

  // Métodos de conveniência para diferentes tipos de log
  async logAudit(message, userId, metadata = {}) {
    return await this.createLog({
      level: 'warn',
      type: 'audit',
      message,
      userId,
      metadata
    });
  }

  async logSecurity(message, ip, userAgent, metadata = {}) {
    return await this.createLog({
      level: 'error',
      type: 'security',
      message,
      ip,
      userAgent,
      metadata
    });
  }

  async logPerformance(message, responseTime, endpoint, method, metadata = {}) {
    return await this.createLog({
      level: 'info',
      type: 'performance',
      message,
      endpoint,
      method,
      responseTime,
      metadata
    });
  }

  async logSystemEvent(message, metadata = {}) {
    return await this.createLog({
      level: 'info',
      type: 'system',
      message,
      metadata
    });
  }

  async logDatabaseOperation(message, metadata = {}) {
    return await this.createLog({
      level: 'info',
      type: 'database',
      message,
      metadata
    });
  }

  async cleanupOldLogs(daysToKeep = 30) {
    try {
      const deletedCount = await this.logRepository.deleteOldLogs(daysToKeep);
      
      await this.logSystemEvent(`Limpeza de logs concluída`, {
        deletedLogs: deletedCount,
        daysToKeep
      });

      return { success: true, deletedCount };
    } catch (error) {
      logger.error('Erro na limpeza de logs:', error);
      return { success: false, error: error.message };
    }
  }
}

module.exports = LoggingService;