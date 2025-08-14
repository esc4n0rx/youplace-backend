const logger = require('../config/logger');

class PixelBroadcaster {
  constructor(io, roomManager, batchManager, redisService) {
    this.io = io;
    this.roomManager = roomManager;
    this.batchManager = batchManager;
    this.redisService = redisService;
    
    this.setupBatchHandler();
    this.setupRedisSubscription();
  }

  setupBatchHandler() {
    this.batchManager.onBatchReady((batchData) => {
      this.broadcastBatch(batchData);
    });
  }

  setupRedisSubscription() {
    // Subscrever ao canal de pixels para receber de outras instâncias
    this.redisService.subscribe('pixel_painted', (data) => {
      this.handlePixelFromRedis(data);
    });
  }

  broadcastPixel(pixel) {
    const roomId = this.roomManager.getRoomId(pixel.x, pixel.y);
    
    // Adicionar ao batch manager
    this.batchManager.addPixel(roomId, pixel);
    
    // Publicar no Redis para outras instâncias
    this.redisService.publish('pixel_painted', {
      ...pixel,
      sourceInstance: process.env.INSTANCE_ID || 'unknown'
    });
  }

  handlePixelFromRedis(data) {
    // Evitar loop infinito - não processar pixels da própria instância
    if (data.sourceInstance === (process.env.INSTANCE_ID || 'unknown')) {
      return;
    }

    const roomId = this.roomManager.getRoomId(data.x, data.y);
    this.batchManager.addPixel(roomId, data);
  }

  broadcastBatch(batchData) {
    const { roomId, pixels, timestamp, count } = batchData;
    
    // Obter usuários conectados ao room
    const roomUsers = this.roomManager.getRoomUsers(roomId);
    
    if (roomUsers.size === 0) {
      logger.debug('No users in room for batch', { roomId, count });
      return;
    }

    // Preparar payload otimizado
    const payload = {
      type: 'pixels_batch',
      room: roomId,
      pixels: pixels.map(p => ({
        x: p.x,
        y: p.y,
        color: p.color,
        username: p.username,
        timestamp: p.timestamp || timestamp
      })),
      count,
      timestamp
    };

    // Broadcast para todos os usuários do room
    for (const socketId of roomUsers) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit('pixels_update', payload);
      }
    }

    logger.debug('Batch broadcasted', {
      roomId,
      userCount: roomUsers.size,
      pixelCount: count
    });

    // Atualizar estatísticas do room
    this.updateRoomStats(roomId, count);
  }

  async updateRoomStats(roomId, pixelCount) {
    try {
      const stats = await this.redisService.getRoomStats(roomId);
      stats.lastActivity = new Date().toISOString();
      stats.pixelCount = (stats.pixelCount || 0) + pixelCount;
      
      await this.redisService.updateRoomStats(roomId, stats);
    } catch (error) {
      logger.error('Error updating room stats:', error);
    }
  }

  broadcastRoomState(socketId, roomId) {
    const socket = this.io.sockets.sockets.get(socketId);
    if (!socket) return;

    // Enviar estado atual do room (últimos pixels)
    this.redisService.getRoomPixels(roomId, 100).then(pixels => {
      if (pixels.length > 0) {
        socket.emit('room_state', {
          roomId,
          pixels,
          timestamp: Date.now()
        });
      }
    }).catch(error => {
      logger.error('Error getting room state:', error);
    });
  }

  broadcastUserCount(roomId) {
    const userCount = this.roomManager.getRoomUsers(roomId).size;
    const roomUsers = this.roomManager.getRoomUsers(roomId);

    for (const socketId of roomUsers) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket) {
        socket.emit('room_users', {
          roomId,
          userCount,
          timestamp: Date.now()
        });
      }
    }
  }

  // Método para broadcast de eventos especiais
  broadcastSpecialEvent(eventType, data, roomId = null) {
    const payload = {
      type: eventType,
      data,
      timestamp: Date.now()
    };

    if (roomId) {
      // Broadcast para room específico
      const roomUsers = this.roomManager.getRoomUsers(roomId);
      for (const socketId of roomUsers) {
        const socket = this.io.sockets.sockets.get(socketId);
        if (socket) {
          socket.emit('special_event', payload);
        }
      }
    } else {
      // Broadcast global
      this.io.emit('special_event', payload);
    }
  }

  getStats() {
    return {
      broadcaster: {
        activeRooms: this.roomManager.getRoomCount(),
        totalUsers: this.roomManager.getTotalUsers()
      },
      batchManager: this.batchManager.getBatchStats()
    };
  }
}

module.exports = PixelBroadcaster;