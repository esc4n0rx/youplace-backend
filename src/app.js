const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { rateLimiting } = require('./config/environment');
const authRoutes = require('./presentation/routes/auth-routes');
const pixelRoutes = require('./presentation/routes/pixel-routes');
const creditRoutes = require('./presentation/routes/credit-routes');
const gamificationRoutes = require('./presentation/routes/gamification-routes');
const monitoringRoutes = require('./presentation/routes/monitoring-routes');
const adminRoutes = require('./presentation/routes/admin-routes');
const realtimeRoutes = require('./presentation/routes/realtime-routes'); // NOVO
const { errorHandler, notFoundHandler } = require('./presentation/middlewares/error-middleware');
const { 
  morganMiddleware, 
  structuredLogging, 
  errorLogging, 
  securityLogging 
} = require('./presentation/middlewares/logging-middleware');
const { 
  requestMonitoring, 
  rateLimitMonitoring,
  resourceMonitoring 
} = require('./presentation/middlewares/monitoring-middleware');
const { checkIpBan, checkUserBan } = require('./presentation/middlewares/admin-middleware');
const DailyBonusJob = require('./jobs/daily-bonus-job');

const app = express();

// Inicializar job de bônus diário
const dailyBonusJob = new DailyBonusJob();

// Middleware de segurança
app.use(helmet());

// CORS
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? frontendDomains
    : ['http://localhost:3000', 'https://youplace.space', 'https://www.youplace.space'],
  // ...
}));

// Rate limiting geral
const limiter = rateLimit({
  windowMs: rateLimiting.windowMs,
  max: rateLimiting.maxRequests,
  message: {
    success: false,
    error: 'Muitas requisições. Tente novamente em alguns minutos.'
  }
});
app.use(limiter);

// Trust proxy para obter IP real (importante para rate limiting e anti-abuse)
app.set('trust proxy', 1);

// Health check
app.get('/health', (req, res) => {
  const realtimeStats = req.realtimeService ? 
    req.realtimeService.getSystemStats() : 
    { error: 'RealtimeService not available' };

  res.status(200).json({
    success: true,
    message: 'YouPlace Backend is running',
    timestamp: new Date().toISOString(),
    cronJobs: {
      dailyBonus: 'active'
    },
    version: '1.0.0',
    uptime: process.uptime(),
    realtime: realtimeStats
  });
});

// Rota alternativa para compatibilidade com healthcheck
app.get('/api/v1/health', (req, res) => {
  res.status(200).json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    env: process.env.NODE_ENV
  });
});


// === LOGGING E MONITORAMENTO ===
app.use(morganMiddleware); // HTTP logging
app.use(structuredLogging); // Log estruturado
app.use(requestMonitoring); // Métricas de request
app.use(rateLimitMonitoring); // Monitoramento de rate limit
app.use(resourceMonitoring); // Monitoramento de recursos
app.use(securityLogging); // Detecção de atividades suspeitas

// === MIDDLEWARES DE BANIMENTO ===
app.use(checkIpBan); // Verificar banimento de IP em todas as rotas

// Parsing de JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ✨ NOVO: Middleware para injetar RealtimeService nos controllers
app.use((req, res, next) => {
  req.realtimeService = app.locals.realtimeService;
  next();
});

// Rotas da API
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/pixels', checkUserBan, pixelRoutes);
app.use('/api/v1/credits', checkUserBan, creditRoutes);
app.use('/api/v1/gamification', checkUserBan, gamificationRoutes);
app.use('/api/v1/monitoring', monitoringRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/realtime', realtimeRoutes); // NOVO: rotas de tempo real

// Middleware de erro de logging ANTES do handler de erro
app.use(errorLogging);

// Middleware de erro 404
app.use(notFoundHandler);

// Middleware de tratamento de erros
app.use(errorHandler);

// Inicializar cron jobs
if (process.env.NODE_ENV !== 'test') {
  dailyBonusJob.start();
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Recebido SIGTERM, parando jobs...');
  dailyBonusJob.stop();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Recebido SIGINT, parando jobs...');
  dailyBonusJob.stop();
  process.exit(0);
});

module.exports = app;