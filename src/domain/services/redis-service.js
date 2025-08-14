const { redis, redisPub, redisSub } = require('../../config/redis');
const logger = require('../../config/logger');

class RedisService {
  constructor() {
    this.redis = redis;
    this.publisher = redisPub;
    this.subscriber = redisSub;
    this.subscriptions = new Map();
  }

  // === OPERAÇÕES BÁSICAS ===

  async get(key) {
    try {
      const value = await this.redis.get(key);
      return value ? JSON.parse(value) : null;
    } catch (error) {
      logger.error('Redis GET error:', { key, error: error.message });
      return null;
    }
  }

  async set(key, value, ttl = null) {
    try {
      const serialized = JSON.stringify(value);
      if (ttl) {
        await this.redis.setex(key, ttl, serialized);
      } else {
        await this.redis.set(key, serialized);
      }
      return true;
    } catch (error) {
      logger.error('Redis SET error:', { key, error: error.message });
      return false;
    }
  }

  async del(key) {
    try {
      return await this.redis.del(key);
    } catch (error) {
      logger.error('Redis DEL error:', { key, error: error.message });
      return false;
    }
  }

  // === OPERAÇÕES DE ROOM ===

  async getRoomState(roomId) {
    const key = `room:${roomId}:state`;
    return await this.get(key);
  }

  async setRoomState(roomId, state, ttl = 3600) {
    const key = `room:${roomId}:state`;
    return await this.set(key, state, ttl);
  }

  async addPixelToRoom(roomId, pixel) {
    const key = `room:${roomId}:pixels`;
    try {
      await this.redis.lpush(key, JSON.stringify(pixel));
      await this.redis.ltrim(key, 0, 999); // Manter apenas últimos 1000 pixels
      await this.redis.expire(key, 3600); // TTL de 1 hora
      return true;
    } catch (error) {
      logger.error('Redis ADD_PIXEL error:', { roomId, error: error.message });
      return false;
    }
  }

  async getRoomPixels(roomId, limit = 100) {
    const key = `room:${roomId}:pixels`;
    try {
      const pixels = await this.redis.lrange(key, 0, limit - 1);
      return pixels.map(pixel => JSON.parse(pixel));
    } catch (error) {
      logger.error('Redis GET_ROOM_PIXELS error:', { roomId, error: error.message });
      return [];
    }
  }

  // === PUB/SUB ===

  async publish(channel, message) {
    try {
      const serialized = JSON.stringify(message);
      await this.publisher.publish(channel, serialized);
      return true;
    } catch (error) {
      logger.error('Redis PUBLISH error:', { channel, error: error.message });
      return false;
    }
  }

  async subscribe(channel, callback) {
    try {
      if (!this.subscriptions.has(channel)) {
        await this.subscriber.subscribe(channel);
        this.subscriptions.set(channel, new Set());
      }
      
      this.subscriptions.get(channel).add(callback);
      
      this.subscriber.on('message', (receivedChannel, message) => {
        if (receivedChannel === channel) {
          try {
            const parsed = JSON.parse(message);
            callback(parsed);
          } catch (error) {
            logger.error('Redis message parse error:', { channel, error: error.message });
          }
        }
      });

      return true;
    } catch (error) {
      logger.error('Redis SUBSCRIBE error:', { channel, error: error.message });
      return false;
    }
  }

  async unsubscribe(channel, callback = null) {
    try {
      if (this.subscriptions.has(channel)) {
        if (callback) {
          this.subscriptions.get(channel).delete(callback);
          if (this.subscriptions.get(channel).size === 0) {
            await this.subscriber.unsubscribe(channel);
            this.subscriptions.delete(channel);
          }
        } else {
          await this.subscriber.unsubscribe(channel);
          this.subscriptions.delete(channel);
        }
      }
      return true;
    } catch (error) {
      logger.error('Redis UNSUBSCRIBE error:', { channel, error: error.message });
      return false;
    }
  }

  // === ESTATÍSTICAS ===

  async getRoomStats(roomId) {
    const key = `room:${roomId}:stats`;
    return await this.get(key) || {
      connectedUsers: 0,
      lastActivity: null,
      pixelCount: 0
    };
  }

  async updateRoomStats(roomId, stats) {
    const key = `room:${roomId}:stats`;
    return await this.set(key, stats, 1800); // TTL de 30 minutos
  }

  async incrementRoomUsers(roomId) {
    const key = `room:${roomId}:users`;
    try {
      const count = await this.redis.incr(key);
      await this.redis.expire(key, 3600);
      return count;
    } catch (error) {
      logger.error('Redis INCR_USERS error:', { roomId, error: error.message });
      return 0;
    }
  }

  async decrementRoomUsers(roomId) {
    const key = `room:${roomId}:users`;
    try {
      const count = await this.redis.decr(key);
      if (count <= 0) {
        await this.redis.del(key);
      }
      return Math.max(0, count);
    } catch (error) {
      logger.error('Redis DECR_USERS error:', { roomId, error: error.message });
      return 0;
    }
  }

  // === CLEANUP ===

  async cleanup() {
    try {
      // Limpar rooms inativos (sem usuários há mais de 1 hora)
      const pattern = 'room:*:users';
      const keys = await this.redis.keys(pattern);
      
      for (const key of keys) {
        const ttl = await this.redis.ttl(key);
        if (ttl <= 0) {
          const roomId = key.split(':')[1];
          await this.del(`room:${roomId}:state`);
          await this.del(`room:${roomId}:pixels`);
          await this.del(`room:${roomId}:stats`);
        }
      }
      
      logger.info('Redis cleanup completed');
      return true;
    } catch (error) {
      logger.error('Redis cleanup error:', error);
      return false;
    }
  }
}

module.exports = RedisService;