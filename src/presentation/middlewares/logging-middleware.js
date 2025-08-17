const morgan = require('morgan');
const logger = require('../../config/logger');
const LoggingService = require('../../domain/services/logging-service');

class LoggingMiddleware {
  constructor() {
    this.loggingService = new LoggingService();
  }

  createMorganMiddleware() {
    const morganFormat = ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" :response-time ms';

    return morgan(morganFormat, {
      stream: logger.stream,
      skip: (req, res) => {
        return req.path === '/health' || req.path === '/favicon.ico';
      }
    });
  }

  structuredLogging() {
    const loggingService = this.loggingService; // Capturar referência
    
    return async (req, res, next) => {
      const startTime = process.hrtime.bigint();
      
      const requestData = {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        userId: req.user ? req.user.userId : null,
        timestamp: new Date().toISOString()
      };

      logger.http('Requisição recebida', requestData);

      const originalEnd = res.end;
      res.end = function(...args) {
        const endTime = process.hrtime.bigint();
        const responseTime = Number(endTime - startTime) / 1000000;

        const responseData = {
          ...requestData,
          statusCode: res.statusCode,
          responseTime: Math.round(responseTime),
          contentLength: res.get('Content-Length') || 0
        };

        // CORREÇÃO: Usar a referência capturada
        setImmediate(async () => {
          try {
            await loggingService.createLog({
              level: res.statusCode >= 400 ? 'error' : 'info',
              type: res.statusCode >= 400 ? 'error' : 'http',
              message: `${req.method} ${req.originalUrl} - ${res.statusCode}`,
              userId: requestData.userId,
              ip: requestData.ip,
              userAgent: requestData.userAgent,
              endpoint: req.originalUrl,
              method: req.method,
              statusCode: res.statusCode,
              responseTime: responseData.responseTime,
              metadata: {
                contentLength: responseData.contentLength,
                query: req.query,
                params: req.params
              }
            });
          } catch (error) {
            console.error('Erro ao salvar log estruturado:', error);
          }
        });

        const logLevel = res.statusCode >= 500 ? 'error' : 
                        res.statusCode >= 400 ? 'warn' : 'info';
        
        logger[logLevel]('Resposta enviada', responseData);
        originalEnd.apply(this, args);
      };

      next();
    };
  }

  errorLogging() {
    const loggingService = this.loggingService; // Capturar referência
    
    return async (err, req, res, next) => {
      const errorData = {
        message: err.message,
        stack: err.stack,
        method: req.method,
        url: req.originalUrl,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        userId: req.user ? req.user.userId : null,
        body: req.body,
        query: req.query,
        params: req.params
      };

      logger.error('Erro na aplicação', errorData);

      try {
        await loggingService.createLog({
          level: 'error',
          type: 'application_error',
          message: `Erro: ${err.message}`,
          userId: errorData.userId,
          ip: errorData.ip,
          userAgent: errorData.userAgent,
          endpoint: errorData.url,
          method: errorData.method,
          metadata: {
            stack: err.stack,
            body: errorData.body,
            query: errorData.query,
            params: errorData.params
          }
        });
      } catch (logError) {
        console.error('Erro ao salvar log de erro:', logError);
      }

      next(err);
    };
  }

  auditMiddleware(action) {
    const loggingService = this.loggingService; // Capturar referência
    
    return async (req, res, next) => {
      res.on('finish', async () => {
        if (res.statusCode < 400 && req.user) {
          try {
            await loggingService.logAudit(
              `Ação realizada: ${action}`,
              req.user.userId,
              {
                action,
                endpoint: req.originalUrl,
                method: req.method,
                ip: req.ip,
                userAgent: req.get('User-Agent'),
                body: req.body,
                query: req.query,
                params: req.params
              }
            );
          } catch (error) {
            console.error('Erro no log de auditoria:', error);
          }
        }
      });

      next();
    };
  }

  securityLogging() {
    const loggingService = this.loggingService; // Capturar referência
    
    return async (req, res, next) => {
      const suspiciousPatterns = [
        /(\.\.|\/etc\/|\/var\/|\/usr\/)/i,
        /(script|javascript|vbscript)/i,
        /(union|select|insert|update|delete|drop)/i,
        /(<script|<iframe|<object)/i
      ];

      const requestString = `${req.originalUrl} ${JSON.stringify(req.body)} ${JSON.stringify(req.query)}`;
      
      const isSuspicious = suspiciousPatterns.some(pattern => 
        pattern.test(requestString)
      );

      if (isSuspicious) {
        logger.security('Atividade suspeita detectada', {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          method: req.method,
          url: req.originalUrl,
          body: req.body,
          query: req.query,
          pattern: 'suspicious_request'
        });

        try {
          await loggingService.logSecurity(
            'Tentativa de ataque detectada',
            req.ip,
            req.get('User-Agent'),
            {
              method: req.method,
              url: req.originalUrl,
              body: req.body,
              query: req.query,
              type: 'suspicious_request'
            }
          );
        } catch (error) {
          console.error('Erro ao salvar log de segurança:', error);
        }
      }

      next();
    };
  }
}

const loggingMiddleware = new LoggingMiddleware();

module.exports = {
  morganMiddleware: loggingMiddleware.createMorganMiddleware(),
  structuredLogging: loggingMiddleware.structuredLogging(),
  errorLogging: loggingMiddleware.errorLogging(),
  auditMiddleware: loggingMiddleware.auditMiddleware.bind(loggingMiddleware),
  securityLogging: loggingMiddleware.securityLogging()
};