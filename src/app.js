const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { rateLimiting } = require('./config/environment');
const authRoutes = require('./presentation/routes/auth-routes');
const pixelRoutes = require('./presentation/routes/pixel-routes');
const creditRoutes = require('./presentation/routes/credit-routes');
const gamificationRoutes = require('./presentation/routes/gamification-routes'); // NOVO
const { errorHandler, notFoundHandler } = require('./presentation/middlewares/error-middleware');
const DailyBonusJob = require('./jobs/daily-bonus-job');

const app = express();

// Inicializar job de bônus diário
const dailyBonusJob = new DailyBonusJob();

// Middleware de segurança
app.use(helmet());

// CORS
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com'] // Substitua pelo seu domínio em produção
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
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

// Parsing de JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging básico
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - IP: ${req.ip}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'YouPlace Backend is running',
    timestamp: new Date().toISOString(),
    cronJobs: {
      dailyBonus: 'active'
    }
  });
});

// Rotas da API
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/pixels', pixelRoutes);
app.use('/api/v1/credits', creditRoutes);
app.use('/api/v1/gamification', gamificationRoutes); // NOVO

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