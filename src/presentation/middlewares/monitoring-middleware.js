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

        // CORREÇÃO: Capturar o contexto da instância de middleware
        const monitoringService = req.app.locals.monitoringService || 
                                 new MonitoringService();

        // Registrar métricas assíncronamente
        setImmediate(async () => {
          try {
            const userId = req.user ? req.user.userId : null;
            
            // Registrar tempo de resposta
            await monitoringService.recordResponseTime(
              req.route ? req.route.path : req.path,
              req.method,
              Math.round(responseTime),
              res.statusCode,
              userId
            );

            // Registrar contagem de requisições
            await monitoringService.recordRequest(
              req.route ? req.route.path : req.path,
              req.method,
              res.statusCode,
              userId
            );

            // Registrar erros
            if (res.statusCode >= 400) {
              await monitoringService.recordError(
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
        });

        originalEnd.apply(this, args);
      };

      next();
    };
  }

  // Middleware para monitorar ações específicas do usuário
  userActionMonitoring(action) {
    return async (req, res, next) => {
      res.on('finish', async () => {
        if (res.statusCode < 400 && req.user) {
          try {
            const monitoringService = req.app.locals.monitoringService || 
                                     new MonitoringService();
            
            await monitoringService.recordUserAction(
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
          const monitoringService = req.app.locals.monitoringService || 
                                   new MonitoringService();
          
          await monitoringService.recordMetric(
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
          console.error('Erro ao registrar performance:', error);
        }
      };

      next();
    };
  }

  // Middleware para monitoramento de recursos do sistema
  resourceMonitoring() {
    return async (req, res, next) => {
      try {
        const memUsage = process.memoryUsage();
        const monitoringService = req.app.locals.monitoringService || 
                                 new MonitoringService();
        
        await monitoringService.recordMetric(
          'memory_usage',
          Math.round(memUsage.heapUsed / 1024 / 1024), // MB
          'mb',
          {
            heap_total: Math.round(memUsage.heapTotal / 1024 / 1024),
            heap_used: Math.round(memUsage.heapUsed / 1024 / 1024),
            external: Math.round(memUsage.external / 1024 / 1024),
            endpoint: req.originalUrl
          }
        );
      } catch (error) {
        console.error('Erro ao registrar uso de recursos:', error);
      }

      next();
    };
  }

  // Middleware para monitoramento de rate limiting
  rateLimitMonitoring() {
    return async (req, res, next) => {
      res.on('finish', async () => {
        if (res.statusCode === 429) { // Too Many Requests
          try {
            const monitoringService = req.app.locals.monitoringService || 
                                     new MonitoringService();
            
            await monitoringService.recordSystemEvent(
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