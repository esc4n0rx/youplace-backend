const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

// CORREÇÃO: Importar as variáveis necessárias do environment
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
const realtimeRoutes = require('./presentation/routes/realtime-routes');
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
dailyBonusJob.start();

app.locals.dailyBonusJob = dailyBonusJob;

// Middleware de segurança
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORREÇÃO PRINCIPAL: CORS configurado corretamente para produção
app.use(cors({
  origin: function (origin, callback) {
    // Permitir requisições sem origin (ex: mobile apps, Postman, testes)
    if (!origin) return callback(null, true);
    
    // CORRIGIDO: Usar frontendDomains sempre, seja produção ou desenvolvimento
    const allowedOrigins = frontendDomains;
      
    console.log('CORS Check:', { 
      origin, 
      allowedOrigins, 
      nodeEnv,
      isAllowed: allowedOrigins.includes(origin)
    });
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    const msg = `Origin ${origin} não permitida pelo CORS. Domínios permitidos: ${allowedOrigins.join(', ')}`;
    console.warn(msg);
    return callback(new Error(msg), false);
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
  exposedHeaders: ['set-cookie'],
  optionsSuccessStatus: 200,
  preflightContinue: false
}));


// Rate limiting geral
const limiter = rateLimit({
  windowMs: rateLimiting.windowMs,
  max: rateLimiting.maxRequests,
  message: {
    success: false,
    error: 'Muitas requisições. Tente novamente em alguns minutos.'
  },
  standardHeaders: true,
  legacyHeaders: false
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
    { status: 'not_initialized' };

  res.json({
    success: true,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: nodeEnv,
    realtime: realtimeStats
  });
});

// === ROTAS ===
app.use('/auth', authRoutes);
app.use('/pixels', pixelRoutes);
app.use('/credits', creditRoutes);
app.use('/gamification', gamificationRoutes);
app.use('/monitoring', monitoringRoutes);
app.use('/admin', adminRoutes);
app.use('/realtime', realtimeRoutes);

// Middleware de tratamento de erros (deve ser o último)
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;