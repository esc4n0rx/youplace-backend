const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const { rateLimiting } = require('./config/environment');
const authRoutes = require('./presentation/routes/auth-routes');
const { errorHandler, notFoundHandler } = require('./presentation/middlewares/error-middleware');

const app = express();

// Middleware de segurança
app.use(helmet());

// CORS
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['https://yourdomain.com'] // Substitua pelo seu domínio em produção
    : ['http://localhost:3000', 'http://localhost:3001'],
  credentials: true
}));

// Rate limiting
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
    timestamp: new Date().toISOString()
  });
});

// Rotas da API
app.use('/api/v1/auth', authRoutes);

// Middleware de erro 404
app.use(notFoundHandler);

// Middleware de tratamento de erros
app.use(errorHandler);

module.exports = app;