const Redis = require('ioredis');
const { redis: redisConfig } = require('./environment');

// Configuração otimizada para Redis externo
const connectionConfig = {
  host: redisConfig.host,
  port: redisConfig.port,
  password: redisConfig.password,
  db: redisConfig.db,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  connectTimeout: 10000,
  commandTimeout: 5000,
  lazyConnect: true,
  keepAlive: 30000,
  // Configurações para conexão externa
  enableReadyCheck: true,
  maxLoadingTimeout: 10000,
  // Reconexão automática
  retryPolicy: (times) => {
    const delay = Math.min(times * 50, 2000);
    console.log(`🔄 Redis reconnecting attempt ${times}, delay: ${delay}ms`);
    return delay;
  }
};

// Cliente principal para operações gerais
const redis = new Redis(connectionConfig);

// Cliente dedicado para PubSub
const redisPub = new Redis(connectionConfig);
const redisSub = new Redis(connectionConfig);

// Event handlers com logs mais detalhados
redis.on('connect', () => {
  console.log(`✅ Redis connected to ${redisConfig.host}:${redisConfig.port}`);
});

redis.on('error', (error) => {
  console.error('❌ Redis connection error:', {
    host: redisConfig.host,
    port: redisConfig.port,
    error: error.message
  });
});

redis.on('ready', () => {
  console.log(`🚀 Redis ready and operational at ${redisConfig.host}:${redisConfig.port}`);
});

redis.on('close', () => {
  console.log('🔌 Redis connection closed');
});

redis.on('reconnecting', (delay) => {
  console.log(`🔄 Redis reconnecting in ${delay}ms...`);
});

// PubSub event handlers
redisPub.on('connect', () => {
  console.log('✅ Redis Publisher connected');
});

redisSub.on('connect', () => {
  console.log('✅ Redis Subscriber connected');
});

// Graceful shutdown com timeout
const gracefulShutdown = () => {
  console.log('🔄 Closing Redis connections...');
  
  Promise.allSettled([
    redis.disconnect(false),
    redisPub.disconnect(false),
    redisSub.disconnect(false)
  ]).then(() => {
    console.log('✅ All Redis connections closed');
  });
};

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Função utilitária para verificar conectividade
const checkConnection = async () => {
  try {
    await redis.ping();
    return true;
  } catch (error) {
    console.error('Redis connectivity check failed:', error.message);
    return false;
  }
};

module.exports = {
  redis,
  redisPub,
  redisSub,
  redisConfig: connectionConfig,
  checkConnection
};