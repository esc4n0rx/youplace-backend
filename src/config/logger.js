const winston = require('winston');
const path = require('path');
const { nodeEnv } = require('./environment');

// Formatos personalizados
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = Object.keys(meta).length ? JSON.stringify(meta, null, 2) : '';
    return `${timestamp} [${level}]: ${message} ${metaStr}`;
  })
);

// Configuração de transportes
const transports = [
  // Console (sempre ativo)
  new winston.transports.Console({
    format: consoleFormat,
    level: nodeEnv === 'production' ? 'info' : 'debug'
  })
];

// Arquivos apenas em produção ou quando especificado
if (nodeEnv === 'production' || process.env.LOG_TO_FILE === 'true') {
  const logDir = process.env.LOG_DIR || 'logs';
  
  transports.push(
    // Log geral
    new winston.transports.File({
      filename: path.join(logDir, 'app.log'),
      format: logFormat,
      level: 'info',
      maxsize: 10485760, // 10MB
      maxFiles: 5
    }),
    
    // Log de erros
    new winston.transports.File({
      filename: path.join(logDir, 'error.log'),
      format: logFormat,
      level: 'error',
      maxsize: 10485760, // 10MB
      maxFiles: 10
    }),
    
    // Log de auditoria (ações importantes)
    new winston.transports.File({
      filename: path.join(logDir, 'audit.log'),
      format: logFormat,
      level: 'warn',
      maxsize: 10485760, // 10MB
      maxFiles: 20
    })
  );
}

// Criar logger principal
const logger = winston.createLogger({
  level: nodeEnv === 'production' ? 'info' : 'debug',
  format: logFormat,
  transports,
  exitOnError: false
});

// Logger específico para HTTP
const httpLogger = winston.createLogger({
  level: 'info',
  format: logFormat,
  transports: [
    new winston.transports.Console({ format: consoleFormat }),
    ...(nodeEnv === 'production' ? [
      new winston.transports.File({
        filename: path.join(process.env.LOG_DIR || 'logs', 'http.log'),
        maxsize: 10485760,
        maxFiles: 5
      })
    ] : [])
  ]
});

// Logger para métricas e monitoramento
const metricsLogger = winston.createLogger({
  level: 'info',
  format: logFormat,
  transports: [
    ...(nodeEnv === 'production' ? [
      new winston.transports.File({
        filename: path.join(process.env.LOG_DIR || 'logs', 'metrics.log'),
        maxsize: 5242880, // 5MB
        maxFiles: 10
      })
    ] : [])
  ]
});

// Métodos auxiliares de logging
const loggers = {
  // Logger principal
  info: (message, meta = {}) => logger.info(message, meta),
  warn: (message, meta = {}) => logger.warn(message, meta),
  error: (message, meta = {}) => logger.error(message, meta),
  debug: (message, meta = {}) => logger.debug(message, meta),
  
  // Logger de auditoria (ações importantes do usuário)
  audit: (message, meta = {}) => logger.warn(message, { ...meta, type: 'audit' }),
  
  // Logger de segurança
  security: (message, meta = {}) => logger.error(message, { ...meta, type: 'security' }),
  
  // Logger de performance
  performance: (message, meta = {}) => metricsLogger.info(message, { ...meta, type: 'performance' }),
  
  // Logger HTTP
  http: (message, meta = {}) => httpLogger.info(message, meta),
  
  // Logger de sistema
  system: (message, meta = {}) => logger.info(message, { ...meta, type: 'system' }),
  
  // Logger de banco de dados
  database: (message, meta = {}) => logger.info(message, { ...meta, type: 'database' }),
  
  // Logger de jobs/cron
  job: (message, meta = {}) => logger.info(message, { ...meta, type: 'job' }),
  
  // Logger de anti-bot
  antiBot: (message, meta = {}) => logger.warn(message, { ...meta, type: 'anti-bot' }),
  
  // Logger de gamificação
  gamification: (message, meta = {}) => logger.info(message, { ...meta, type: 'gamification' })
};

// Stream para Morgan HTTP logging
loggers.stream = {
  write: (message) => {
    httpLogger.info(message.trim());
  }
};

module.exports = loggers;