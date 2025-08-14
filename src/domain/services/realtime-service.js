const RedisService = require('./redis-service');
const logger = require('../../config/logger');

class RealtimeService {
  constructor() {
    this.redisService = new RedisService();
    this.socketServer = null; // Será injetado pelo app.js
  }

  setSocketServer(socketServer) {
    this.socketServer = socketServer;
  }

  async broadcastPixelPainted(pixel) {
    if (!this.socketServer) {
      logger.warn('SocketServer not initialized, cannot broadcast pixel');
      return false;
    }

    try {
      // Broadcast via WebSocket
      this.socketServer.broadcastPixel(pixel);
      
      logger.debug('Pixel broadcasted', {
        x: pixel.x,
        y: pixel.y,
        color: pixel.color,
        username: pixel.username
      });

      return true;
    } catch (error) {
      logger.error('Error broadcasting pixel', { error: error.message, pixel });
      return false;
    }
  }

  async getRoomState(roomId) {
    try {
      const [stats, pixels] = await Promise.all([
        this.redisService.getRoomStats(roomId),
        this.redisService.getRoomPixels(roomId, 100)
      ]);

      return {
        roomId,
        stats,
        recentPixels: pixels,
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error('Error getting room state', { error: error.message, roomId });
      return null;
    }
  }

  async getRoomStats(roomId) {
    try {
      return await this.redisService.getRoomStats(roomId);
    } catch (error) {
      logger.error('Error getting room stats', { error: error.message, roomId });
      return null;
    }
  }

  async getActiveRooms() {
    try {
      // Buscar rooms com usuários conectados
      const pattern = 'room:*:users';
      const keys = await this.redisService.redis.keys(pattern);
      
      const activeRooms = [];
      
      for (const key of keys) {
        const userCount = await this.redisService.redis.get(key);
        if (parseInt(userCount) > 0) {
          const roomId = key.split(':')[1];
          const stats = await this.redisService.getRoomStats(`room_${roomId}`);
          
          activeRooms.push({
            roomId: `room_${roomId}`,
            userCount: parseInt(userCount),
            stats
          });
        }
      }

      return activeRooms.sort((a, b) => b.userCount - a.userCount);
    } catch (error) {
      logger.error('Error getting active rooms', error);
      return [];
    }
  }

  async getSystemStats() {
    if (!this.socketServer) {
      return { error: 'SocketServer not initialized' };
    }

    try {
      const [activeRooms, socketStats] = await Promise.all([
        this.getActiveRooms(),
        Promise.resolve(this.socketServer.getStats())
      ]);

      return {
        websocket: socketStats,
        activeRooms: activeRooms.slice(0, 10), // Top 10 rooms
        totalActiveRooms: activeRooms.length,
        redis: {
          status: this.redisService.redis.status,
          connections: {
            main: this.redisService.redis.status,
            pub: this.redisService.publisher.status,
            sub: this.redisService.subscriber.status
          }
        },
        timestamp: Date.now()
      };
    } catch (error) {
      logger.error('Error getting system stats', error);
      return { error: error.message };
    }
  }

  // Método para broadcast de eventos especiais
  async broadcastSpecialEvent(eventType, data, roomId = null) {
    if (!this.socketServer) {
      logger.warn('SocketServer not initialized, cannot broadcast event');
      return false;
    }

    try {
      this.socketServer.pixelBroadcaster.broadcastSpecialEvent(eventType, data, roomId);
      return true;
    } catch (error) {
      logger.error('Error broadcasting special event', { error: error.message, eventType });
      return false;
    }
  }

  // Cleanup métodos
  async cleanup() {
    try {
      await this.redisService.cleanup();
      logger.info('RealtimeService cleanup completed');
    } catch (error) {
      logger.error('RealtimeService cleanup error', error);
    }
  }
}

module.exports = RealtimeService;