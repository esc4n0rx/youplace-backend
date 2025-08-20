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

// CORREÇÃO: Inicializar E INICIAR job de bônus diário
const dailyBonusJob = new DailyBonusJob();
dailyBonusJob.start();

// Disponibilizar o job globalmente para poder parar no shutdown
app.locals.dailyBonusJob = dailyBonusJob;

// ⚠️ VERSÃO DE TESTE: CORS ULTRA-PERMISSIVO ⚠️
console.log('🚨 ATENÇÃO: CORS em modo TESTE - PERMITE TUDO! 🚨');
app.use(cors({
  origin: true, // 🔓 PERMITE QUALQUER ORIGEM
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH', 'HEAD'],
  allowedHeaders: ['*'], // 🔓 PERMITE QUALQUER HEADER
  exposedHeaders: ['*'], // 🔓 EXPÕE QUALQUER HEADER
  optionsSuccessStatus: 200,
  preflightContinue: false
}));

// 🔓 MIDDLEWARE ULTRA-PERMISSIVO PARA OPTIONS
app.use((req, res, next) => {
  console.log(`🔧 ${req.method} ${req.originalUrl} - Origin: ${req.headers.origin}`);
  
  if (req.method === 'OPTIONS') {
    console.log('✅ Respondendo OPTIONS com headers ultra-permissivos');
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', '*');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Max-Age', '86400');
    res.status(200).end();
    return;
  }
  
  // Para todas as outras requisições
  res.header('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  next();
});

// TEMPORARIAMENTE REMOVIDO: Helmet que pode estar interferindo
// app.use(helmet({
//   crossOriginResourcePolicy: { policy: "cross-origin" }
// }));

// TEMPORARIAMENTE REMOVIDO: Rate limiting que pode estar interferindo
// const limiter = rateLimit({
//   windowMs: rateLimiting.windowMs,
//   max: rateLimiting.maxRequests,
//   message: {
//     success: false,
//     error: 'Muitas requisições. Tente novamente em alguns minutos.'
//   },
//   standardHeaders: true,
//   legacyHeaders: false
// });
// app.use(limiter);

// Trust proxy para obter IP real (importante para rate limiting e anti-abuse)
app.set('trust proxy', 1);


app.use(morganMiddleware);
app.use(structuredLogging);
app.use(requestMonitoring);
app.use(rateLimitMonitoring);
app.use(resourceMonitoring);
app.use(securityLogging);
app.use(checkIpBan);

// Parsing de JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ✨ NOVO: Middleware para injetar RealtimeService nos controllers
app.use((req, res, next) => {
  req.realtimeService = app.locals.realtimeService;
  next();
});

// 🧪 ENDPOINT DE TESTE CORS
app.all('/cors-test', (req, res) => {
  console.log('🧪 CORS Test endpoint chamado:', {
    method: req.method,
    origin: req.headers.origin,
    headers: req.headers
  });
  
  res.json({
    success: true,
    message: 'CORS está funcionando!',
    method: req.method,
    origin: req.headers.origin,
    timestamp: new Date().toISOString()
  });
});


app.get('/api/v1/health', (req, res) => {
  console.log('🏥 Health check chamado:', {
    origin: req.headers.origin,
    method: req.method
  });
  
  const realtimeStats = req.realtimeService ? 
    req.realtimeService.getSystemStats() :
    { status: 'not_initialized' };

  res.json({
    success: true,
    message: 'API funcionando com CORS de teste',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: nodeEnv,
    realtime: realtimeStats,
    jobs: {
      dailyBonus: {
        status: app.locals.dailyBonusJob ? 'running' : 'not_initialized',
        isRunning: app.locals.dailyBonusJob?.isRunning || false
      }
    },
    cors: {
      mode: 'ULTRA_PERMISSIVE_TEST',
      warning: 'Esta configuração é apenas para teste!'
    }
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