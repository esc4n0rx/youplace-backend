const morgan = require('morgan');
const logger = require('../../config/logger');
const LoggingService = require('../../domain/services/logging-service');

class LoggingMiddleware {
  constructor() {
    this.loggingService = new LoggingService();
  }

  // Middleware do Morgan customizado
  createMorganMiddleware() {
    // Formato customizado do Morgan
    const morganFormat = ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" :response-time ms';

    return morgan(morganFormat, {
      stream: logger.stream,
      skip: (req, res) => {
        // Pular health checks e requests internos
        return req.path === '/health' || req.path === '/favicon.ico';
      }
    });
  }

  // Middleware para logging estruturado
  structuredLogging() {
    return async (req, res, next) => {
      const startTime = process.hrtime.bigint();
      
      // Capturar dados da requisição
      const requestData = {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('User-Agent'),
        userId: req.user ? req.user.userId : null,
        timestamp: new Date().toISOString()
      };

      // Log da requisição recebida
      logger.http('Requisição recebida', requestData);

      // Override do res.end para capturar resposta
      const originalEnd = res.end;
      res.end = function(...args) {
        const endTime = process.hrtime.bigint();
        const responseTime = Number(endTime - startTime) / 1000000; // Convert to ms

        // Dados da resposta
        const responseData = {
          ...requestData,
          statusCode: res.statusCode,
          responseTime: Math.round(responseTime),
          contentLength: res.get('Content-Length') || 0
        };

        // Log estruturado assíncrono
        setImmediate(async () => {
          try {
            await this.loggingService.createLog({
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

        // Log imediato no console
        const logLevel = res.statusCode >= 500 ? 'error' : 
                        res.statusCode >= 400 ? 'warn' : 'info';
        
        logger[logLevel]('Resposta enviada', responseData);

        originalEnd.apply(this, args);
      }.bind(res);

      next();
    };
  }

  // Middleware para logging de erros
  errorLogging() {
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

      // Log do erro
      logger.error('Erro na aplicação', errorData);

      // Salvar no banco de dados
      try {
        await this.loggingService.createLog({
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

  // Middleware para auditoria de ações específicas
  auditMiddleware(action) {
    return async (req, res, next) => {
      // Executar após a resposta
      res.on('finish', async () => {
        if (res.statusCode < 400 && req.user) {
          try {
            await this.loggingService.logAudit(
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

  // Middleware para detectar atividades suspeitas
  securityLogging() {
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
          await this.loggingService.logSecurity(
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

// Instância singleton
const loggingMiddleware = new LoggingMiddleware();

module.exports = {
  morganMiddleware: loggingMiddleware.createMorganMiddleware(),
  structuredLogging: loggingMiddleware.structuredLogging(),
  errorLogging: loggingMiddleware.errorLogging(),
  auditMiddleware: loggingMiddleware.auditMiddleware.bind(loggingMiddleware),
  securityLogging: loggingMiddleware.securityLogging()
};