const Redis = require('ioredis');
const { nodeEnv } = require('./environment');

const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: process.env.REDIS_DB || 0,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
  connectTimeout: 10000,
  commandTimeout: 5000,
  lazyConnect: true,
  keepAlive: 30000
};

// Cliente principal para operações gerais
const redis = new Redis(redisConfig);

// Cliente dedicado para PubSub
const redisPub = new Redis(redisConfig);
const redisSub = new Redis(redisConfig);

// Event handlers
redis.on('connect', () => {
  console.log('✅ Redis connected');
});

redis.on('error', (error) => {
  console.error('❌ Redis error:', error);
});

redis.on('ready', () => {
  console.log('🚀 Redis ready');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🔄 Closing Redis connections...');
  redis.disconnect();
  redisPub.disconnect();
  redisSub.disconnect();
});

module.exports = {
  redis,
  redisPub,
  redisSub,
  redisConfig
};