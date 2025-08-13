const MonitoringService = require('../../domain/services/monitoring-service');

class MonitoringMiddleware {
  constructor() {
    this.monitoringService = new MonitoringService();
  }

  // Middleware principal de monitoramento
  requestMonitoring() {
    return async (req, res, next) => {
      const startTime = process.hrtime.bigint();
      
      // Override do res.end para capturar métricas
      const originalEnd = res.end;
      res.end = function(...args) {
        const endTime = process.hrtime.bigint();
        const responseTime = Number(endTime - startTime) / 1000000; // Convert to ms

        // Registrar métricas assíncronamente
        setImmediate(async () => {
          try {
            const userId = req.user ? req.user.userId : null;
            
            // Registrar tempo de resposta
            await this.monitoringService.recordResponseTime(
              req.route ? req.route.path : req.path,
              req.method,
              Math.round(responseTime),
              res.statusCode,
              userId
            );

            // Registrar contagem de requisições
            await this.monitoringService.recordRequest(
              req.route ? req.route.path : req.path,
              req.method,
              res.statusCode,
              userId
            );

            // Registrar erros
            if (res.statusCode >= 400) {
              await this.monitoringService.recordError(
                req.route ? req.route.path : req.path,
                req.method,
                res.statusCode,
                res.locals.errorMessage || 'Unknown error',
                userId
              );
            }
          } catch (error) {
            console.error('Erro ao registrar métricas:', error);
          }
        },bind(this));

        originalEnd.apply(this, args);
      }.bind(res);

      next();
    };
  }

  // Middleware para monitorar ações específicas do usuário
  userActionMonitoring(action) {
    return async (req, res, next) => {
      res.on('finish', async () => {
        if (res.statusCode < 400 && req.user) {
          try {
            await this.monitoringService.recordUserAction(
              action,
              req.user.userId,
              {
                endpoint: req.originalUrl,
                method: req.method,
                statusCode: res.statusCode,
                ip: req.ip,
                userAgent: req.get('User-Agent')
              }
            );
          } catch (error) {
            console.error('Erro ao registrar ação do usuário:', error);
          }
        }
      });

      next();
    };
  }

  // Middleware para monitorar performance de operações específicas
  performanceMonitoring(operationName) {
    return (req, res, next) => {
      const startTime = process.hrtime.bigint();
      
      req.startPerformanceTimer = (subOperation) => {
        return process.hrtime.bigint();
      };

      req.endPerformanceTimer = async (timerStart, subOperation) => {
        const endTime = process.hrtime.bigint();
        const duration = Number(endTime - timerStart) / 1000000;

        try {
          await this.monitoringService.recordMetric(
            'operation_time',
            Math.round(duration),
            'ms',
            {
              operation: operationName,
              subOperation,
              endpoint: req.originalUrl,
              userId: req.user ? req.user.userId : null
            }
          );
        } catch (error) {
          console.error('Erro ao registrar métrica de performance:', error);
        }
      };

      // Registrar tempo total da operação
      res.on('finish', async () => {
        const endTime = process.hrtime.bigint();
        const totalTime = Number(endTime - startTime) / 1000000;

        try {
          await this.monitoringService.recordMetric(
            'operation_total_time',
            Math.round(totalTime),
            'ms',
            {
              operation: operationName,
              endpoint: req.originalUrl,
              method: req.method,
              statusCode: res.statusCode,
              userId: req.user ? req.user.userId : null
            }
          );
        } catch (error) {
          console.error('Erro ao registrar tempo total da operação:', error);
        }
      });

      next();
    };
  }

  // Middleware para monitorar uso de recursos
  resourceMonitoring() {
    return (req, res, next) => {
      const memUsageBefore = process.memoryUsage();
      
      res.on('finish', async () => {
        try {
          const memUsageAfter = process.memoryUsage();
          const memDelta = memUsageAfter.heapUsed - memUsageBefore.heapUsed;

          // Registrar uso de memória se significativo
          if (Math.abs(memDelta) > 1024 * 1024) { // > 1MB
            await this.monitoringService.recordMetric(
              'memory_usage_delta',
              memDelta,
              'bytes',
              {
                endpoint: req.originalUrl,
                method: req.method,
                heapUsed: memUsageAfter.heapUsed,
                heapTotal: memUsageAfter.heapTotal
              }
            );
          }

          // Registrar CPU usage se disponível
          if (process.cpuUsage) {
            const cpuUsage = process.cpuUsage();
            await this.monitoringService.recordMetric(
              'cpu_usage',
              cpuUsage.user + cpuUsage.system,
              'microseconds',
              {
                endpoint: req.originalUrl,
                method: req.method,
                user: cpuUsage.user,
                system: cpuUsage.system
              }
            );
          }
        } catch (error) {
          console.error('Erro ao registrar métricas de recursos:', error);
        }
      });

      next();
    };
  }

  // Middleware para detectar rate limiting
  rateLimitMonitoring() {
    return async (req, res, next) => {
      res.on('finish', async () => {
        if (res.statusCode === 429) {
          try {
            await this.monitoringService.recordMetric(
              'rate_limit_hit',
              1,
              'count',
              {
                endpoint: req.originalUrl,
                method: req.method,
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                userId: req.user ? req.user.userId : null
              }
            );

            await this.monitoringService.recordSystemEvent(
              'rate_limit_triggered',
              'warning',
              {
                endpoint: req.originalUrl,
                ip: req.ip,
                userId: req.user ? req.user.userId : null
              }
            );
          } catch (error) {
            console.error('Erro ao registrar rate limit:', error);
          }
        }
      });

      next();
    };
  }
}

// Instância singleton
const monitoringMiddleware = new MonitoringMiddleware();

module.exports = {
  requestMonitoring: monitoringMiddleware.requestMonitoring(),
  userActionMonitoring: monitoringMiddleware.userActionMonitoring.bind(monitoringMiddleware),
  performanceMonitoring: monitoringMiddleware.performanceMonitoring.bind(monitoringMiddleware),
  resourceMonitoring: monitoringMiddleware.resourceMonitoring(),
  rateLimitMonitoring: monitoringMiddleware.rateLimitMonitoring()
};