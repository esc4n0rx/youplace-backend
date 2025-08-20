const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { 
  rateLimiting, 
  nodeEnv, 
  frontendDomains 
} = require('./config/environment');
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
app.use(helmet({
  crossOriginEmbedderPolicy: false, 

  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
    },
  },
}));

// CORS - Configuração ajustada para produção
app.use(cors({
  origin: function (origin, callback) {
    // Permitir requests sem origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = nodeEnv === 'production' 
      ? frontendDomains // Usar domínios configurados
      : [
          'http://localhost:3000', 
          'http://localhost:3001',
          'https://youplace.space',
          'http://youplace.space',
          'https://www.youplace.space',
          'http://www.youplace.space'
        ];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.warn(`CORS: Origin ${origin} não permitido`);
      callback(new Error('Não permitido pelo CORS'), false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: [
    'Authorization', 
    'Content-Type', 
    'X-Requested-With',
    'Accept',
    'Origin',
    'Cache-Control',
    'X-File-Name'
  ],
  exposedHeaders: ['X-Total-Count', 'X-Page-Count'],
  optionsSuccessStatus: 200, // Para suportar navegadores legados
  preflightContinue: false // Finalizar preflight requests aqui
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

// Health check
app.get('/api/v1/health', (req, res) => {
  const realtimeStats = req.realtimeService ? 
    req.realtimeService.getSystemStats() : 
    { connectedClients: 0, totalRooms: 0 };
    
  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    environment: nodeEnv,
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    realtime: realtimeStats
  });
});

// Middleware de verificação de banimento por usuário (após autenticação)
app.use('/auth', authRoutes);
app.use('/pixels', checkUserBan, pixelRoutes);
app.use('/credits', checkUserBan, creditRoutes);
app.use('/gamification', checkUserBan, gamificationRoutes);
app.use('/monitoring', monitoringRoutes);
app.use('/admin', adminRoutes);
app.use('/realtime', realtimeRoutes); // NOVO

// Middleware de erro (deve ser o último)
app.use(notFoundHandler);
app.use(errorHandler);
app.use(errorLogging);

module.exports = app;