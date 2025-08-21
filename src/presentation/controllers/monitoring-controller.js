const MonitoringService = require('../../domain/services/monitoring-service');
const LoggingService = require('../../domain/services/logging-service');

class MonitoringController {
  constructor() {
    this.monitoringService = new MonitoringService();
    this.loggingService = new LoggingService();
  }

  // Dashboard principal de monitoramento
  getDashboard = async (req, res, next) => {
    try {
      const { timeframe = '24h' } = req.query;

      const [metricsOverview, healthStatus, logStats] = await Promise.all([
        this.monitoringService.getMetricsOverview(timeframe),
        this.monitoringService.getHealthStatus(),
        this.loggingService.getLogStatistics()
      ]);

      res.status(200).json({
        success: true,
        data: {
          health: healthStatus,
          metrics: metricsOverview,
          logs: logStats,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // Status de saúde do sistema
  getHealthStatus = async (req, res, next) => {
    try {
      const healthStatus = await this.monitoringService.getHealthStatus();

      res.status(200).json({
        success: true,
        data: healthStatus
      });
    } catch (error) {
      next(error);
    }
  };

  // Métricas de performance
  getMetrics = async (req, res, next) => {
    try {
      const { timeframe = '24h', type } = req.query;

      if (type) {
        // Métrica específica
        const since = this.monitoringService.getTimeframeSince(timeframe);
        const metrics = await this.monitoringService.monitoringRepository.getMetrics(type, since);
        
        res.status(200).json({
          success: true,
          data: {
            type,
            timeframe,
            metrics: metrics.map(m => m.toJSON())
          }
        });
      } else {
        // Overview geral
        const overview = await this.monitoringService.getMetricsOverview(timeframe);
        
        res.status(200).json({
          success: true,
          data: overview
        });
      }
    } catch (error) {
      next(error);
    }
  };

  // Logs do sistema
  getLogs = async (req, res, next) => {
    try {
      const {
        limit = 100,
        level,
        type,
        userId,
        endpoint,
        since,
        until
      } = req.query;

      const options = { limit: parseInt(limit) };
      if (level) options.level = level;
      if (type) options.type = type;
      if (userId) options.userId = userId;
      if (endpoint) options.endpoint = endpoint;
      if (since) options.since = new Date(since);
      if (until) options.until = new Date(until);

      const logs = await this.loggingService.getRecentLogs(options);

      res.status(200).json({
        success: true,
        data: {
          logs: logs.map(log => log.toJSON()),
          count: logs.length,
          filters: options
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // Estatísticas de logs
  getLogStatistics = async (req, res, next) => {
    try {
      const { since } = req.query;
      const sinceDate = since ? new Date(since) : null;

      const stats = await this.loggingService.getLogStatistics(sinceDate);

      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  };

  // Logs de erro
  getErrorLogs = async (req, res, next) => {
    try {
      const { limit = 50, since } = req.query;
      const sinceDate = since ? new Date(since) : null;

      const errorLogs = await this.loggingService.logRepository.getErrorLogs(
        parseInt(limit),
        sinceDate
      );

      res.status(200).json({
        success: true,
        data: {
          errors: errorLogs.map(log => log.toJSON()),
          count: errorLogs.length
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // Logs de segurança
  getSecurityLogs = async (req, res, next) => {
    try {
      const { limit = 50, since } = req.query;
      const sinceDate = since ? new Date(since) : null;

      const securityLogs = await this.loggingService.logRepository.getSecurityLogs(
        parseInt(limit),
        sinceDate
      );

      res.status(200).json({
        success: true,
        data: {
          securityEvents: securityLogs.map(log => log.toJSON()),
          count: securityLogs.length
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // Requisições lentas
  getSlowRequests = async (req, res, next) => {
    try {
      const { threshold = 1000, limit = 50 } = req.query;

      const slowRequests = await this.loggingService.logRepository.getSlowRequests(
        parseInt(threshold),
        parseInt(limit)
      );

      res.status(200).json({
        success: true,
        data: {
          slowRequests: slowRequests.map(log => log.toJSON()),
          threshold: parseInt(threshold),
          count: slowRequests.length
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // Endpoints mais acessados
  getTopEndpoints = async (req, res, next) => {
    try {
      const { limit = 10, since } = req.query;
      const sinceDate = since ? new Date(since) : null;

      const topEndpoints = await this.loggingService.logRepository.getTopEndpoints(
        parseInt(limit),
        sinceDate
      );

      res.status(200).json({
        success: true,
        data: {
          endpoints: topEndpoints,
          period: sinceDate ? `desde ${sinceDate.toISOString()}` : 'últimas 24h'
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // Alertas e eventos críticos
  getAlerts = async (req, res, next) => {
    try {
      const { limit = 20 } = req.query;
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000); // Últimas 24h

      const [errorLogs, securityLogs, slowRequests] = await Promise.all([
        this.loggingService.logRepository.getErrorLogs(10, since),
        this.loggingService.logRepository.getSecurityLogs(10, since),
        this.loggingService.logRepository.getSlowRequests(2000, 10) // > 2s
      ]);

      const alerts = [
        ...errorLogs.map(log => ({
          ...log.toJSON(),
          alertType: 'error',
          severity: 'high'
        })),
        ...securityLogs.map(log => ({
          ...log.toJSON(),
          alertType: 'security',
          severity: 'critical'
        })),
        ...slowRequests.map(log => ({
          ...log.toJSON(),
          alertType: 'performance',
          severity: 'medium'
        }))
      ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
       .slice(0, parseInt(limit));

      res.status(200).json({
        success: true,
        data: {
          alerts,
          count: alerts.length,
          summary: {
            errors: errorLogs.length,
            securityEvents: securityLogs.length,
            slowRequests: slowRequests.length
          }
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // Métricas em tempo real
  getRealTimeMetrics = async (req, res, next) => {
    try {
      const now = new Date();
      const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);

      const [recentResponseTimes, recentErrors, recentRequests] = await Promise.all([
        this.monitoringService.monitoringRepository.getMetrics('response_time', fiveMinutesAgo, 100),
        this.monitoringService.monitoringRepository.getMetrics('error_count', fiveMinutesAgo, 100),
        this.monitoringService.monitoringRepository.getMetrics('request_count', fiveMinutesAgo, 100)
      ]);

      const currentAvgResponseTime = recentResponseTimes.length > 0 ?
        recentResponseTimes.reduce((sum, m) => sum + m.value, 0) / recentResponseTimes.length : 0;

      const currentErrorRate = recentRequests.length > 0 ?
        (recentErrors.reduce((sum, m) => sum + m.value, 0) / recentRequests.reduce((sum, m) => sum + m.value, 0)) * 100 : 0;

      res.status(200).json({
        success: true,
        data: {
          timestamp: now.toISOString(),
          metrics: {
            avgResponseTime: Math.round(currentAvgResponseTime),
            errorRate: Math.round(currentErrorRate * 100) / 100,
            requestsPerMinute: recentRequests.reduce((sum, m) => sum + m.value, 0),
            errorsPerMinute: recentErrors.reduce((sum, m) => sum + m.value, 0)
          },
          charts: {
            responseTimes: recentResponseTimes.map(m => ({
              timestamp: m.timestamp,
              value: m.value
            })).slice(-20), // Últimos 20 pontos
            errors: recentErrors.map(m => ({
              timestamp: m.timestamp,
              value: m.value
            })).slice(-20)
          }
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // Estatísticas de usuários
  getUserStats = async (req, res, next) => {
    try {
      const { timeframe = '24h' } = req.query;
      const since = this.monitoringService.getTimeframeSince(timeframe);

      const userActions = await this.monitoringService.monitoringRepository.getMetrics('user_action', since);
      
      // Agrupar por tipo de ação
      const actionStats = {};
      userActions.forEach(metric => {
        const action = metric.metadata.action || 'unknown';
        if (!actionStats[action]) {
          actionStats[action] = 0;
        }
        actionStats[action] += metric.value;
      });

      // Top usuários mais ativos
      const userActivityCount = {};
      userActions.forEach(metric => {
        const userId = metric.metadata.userId;
        if (userId) {
          if (!userActivityCount[userId]) {
            userActivityCount[userId] = 0;
          }
          userActivityCount[userId] += metric.value;
        }
      });

      const topUsers = Object.entries(userActivityCount)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .map(([userId, count]) => ({ userId, actionCount: count }));

      res.status(200).json({
        success: true,
        data: {
          timeframe,
          actionStats,
          topUsers,
          totalActions: userActions.reduce((sum, m) => sum + m.value, 0)
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // Limpeza de dados antigos (endpoint administrativo)
  cleanupOldData = async (req, res, next) => {
    try {
      const { logDays = 30, metricDays = 7 } = req.body;

      const [logCleanup, metricCleanup] = await Promise.all([
        this.loggingService.cleanupOldLogs(parseInt(logDays)),
        this.monitoringService.cleanupOldMetrics(parseInt(metricDays))
      ]);

      res.status(200).json({
        success: true,
        message: 'Limpeza de dados concluída',
        data: {
          logs: logCleanup,
          metrics: metricCleanup
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // Export de logs (para análise externa)
  exportLogs = async (req, res, next) => {
    try {
      const {
        format = 'json',
        since,
        until,
        level,
        type,
        limit = 1000
      } = req.query;

      const options = { limit: parseInt(limit) };
      if (level) options.level = level;
      if (type) options.type = type;
      if (since) options.since = new Date(since);
      if (until) options.until = new Date(until);

      const logs = await this.loggingService.getRecentLogs(options);

      if (format === 'csv') {
        // Converter para CSV
        const csvHeaders = 'timestamp,level,type,message,endpoint,method,statusCode,responseTime,userId,ip\n';
        const csvData = logs.map(log => 
          `${log.createdAt},${log.level},${log.type},"${log.message}",${log.endpoint || ''},${log.method || ''},${log.statusCode || ''},${log.responseTime || ''},${log.userId || ''},${log.ip || ''}`
        ).join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=logs-${new Date().toISOString().split('T')[0]}.csv`);
        res.send(csvHeaders + csvData);
      } else {
        // JSON (padrão)
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=logs-${new Date().toISOString().split('T')[0]}.json`);
        res.json({
          exportedAt: new Date().toISOString(),
          filters: options,
          count: logs.length,
          logs: logs.map(log => log.toJSON())
        });
      }
    } catch (error) {
      next(error);
    }
  };

  // Teste de conectividade e saúde dos serviços
  getServiceHealth = async (req, res, next) => {
    try {
      const services = {
        database: { status: 'unknown', responseTime: 0 },
        logging: { status: 'unknown', responseTime: 0 },
        monitoring: { status: 'unknown', responseTime: 0 }
      };

      // Teste do banco de dados
      try {
        const dbStart = process.hrtime.bigint();
        await this.loggingService.logRepository.logRepository.findRecent(1);
        const dbEnd = process.hrtime.bigint();
        services.database = {
          status: 'healthy',
          responseTime: Number(dbEnd - dbStart) / 1000000
        };
      } catch (error) {
        services.database = { status: 'unhealthy', error: error.message };
      }

      // Teste do logging
      try {
        const logStart = process.hrtime.bigint();
        await this.loggingService.createLog({
          level: 'info',
          type: 'health_check',
          message: 'Health check test log'
        });
        const logEnd = process.hrtime.bigint();
        services.logging = {
          status: 'healthy',
          responseTime: Number(logEnd - logStart) / 1000000
        };
      } catch (error) {
        services.logging = { status: 'unhealthy', error: error.message };
      }

      // Teste do monitoring
      try {
        const monStart = process.hrtime.bigint();
        await this.monitoringService.recordMetric('health_check', 1, 'count');
        const monEnd = process.hrtime.bigint();
        services.monitoring = {
          status: 'healthy',
          responseTime: Number(monEnd - monStart) / 1000000
        };
      } catch (error) {
        services.monitoring = { status: 'unhealthy', error: error.message };
      }

      const overallStatus = Object.values(services).every(s => s.status === 'healthy') ? 'healthy' : 'degraded';

      res.status(200).json({
        Health: { Status: overallStatus }
      });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = MonitoringController;