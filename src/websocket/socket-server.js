const { Server } = require('socket.io');
const RoomManager = require('./room-manager');
const BatchManager = require('./batch-manager');
const PixelBroadcaster = require('./pixel-broadcaster');
const RedisService = require('../domain/services/redis-service');
const SocketAuthMiddleware = require('../presentation/middlewares/socket-auth-middleware');
const logger = require('../config/logger');

class SocketServer {
  constructor(httpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.NODE_ENV === 'production' 
          ? ['https://yourdomain.com'] 
          : ['http://localhost:3000', 'http://localhost:3001'],
        methods: ['GET', 'POST'],
        credentials: true
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000
    });

    this.redisService = new RedisService();
    this.roomManager = new RoomManager();
    this.batchManager = new BatchManager(this.redisService);
    this.pixelBroadcaster = new PixelBroadcaster(
      this.io, 
      this.roomManager, 
      this.batchManager, 
      this.redisService
    );
    
    this.authMiddleware = new SocketAuthMiddleware();
    this.setupMiddlewares();
    this.setupEventHandlers();
    this.setupCleanupJobs();

    logger.info('SocketServer initialized');
  }

  setupMiddlewares() {
    // Autenticação obrigatória
    this.io.use(this.authMiddleware.authenticate());
    
    // Rate limiting
    this.io.use(this.authMiddleware.rateLimit(100)); // 100 eventos por minuto
  }

  setupEventHandlers() {
    this.io.on('connection', (socket) => {
      logger.info('User connected', {
        socketId: socket.id,
        userId: socket.user.id,
        username: socket.user.username
      });

      this.handleConnection(socket);
      this.handleRoomEvents(socket);
      this.handleViewportEvents(socket);
      this.handleDisconnection(socket);
    });
  }

  handleConnection(socket) {
    // Enviar confirmação de conexão
    socket.emit('connected', {
      socketId: socket.id,
      user: socket.user,
      timestamp: Date.now(),
      serverInfo: {
        version: '1.0.0',
        features: ['realtime_pixels', 'room_management', 'batching']
      }
    });

    // Estatísticas de conexão
    socket.emit('connection_stats', {
      totalConnections: this.io.sockets.sockets.size,
      activeRooms: this.roomManager.getRoomCount()
    });
  }

  handleRoomEvents(socket) {
    // Entrar em rooms específicos
    socket.on('join_rooms', (data) => {
      try {
        const { rooms } = data;
        
        if (!Array.isArray(rooms) || rooms.length === 0) {
          socket.emit('error', { message: 'Invalid rooms data' });
          return;
        }

        // Validar rooms
        const validRooms = rooms.filter(roomId => 
          this.roomManager.isValidRoom(roomId)
        );

        if (validRooms.length !== rooms.length) {
          socket.emit('error', { message: 'Some rooms are invalid' });
          return;
        }

        // Limitar número de rooms por usuário
        if (validRooms.length > 50) {
          socket.emit('error', { message: 'Too many rooms (max: 50)' });
          return;
        }

        // Atualizar rooms do usuário
        this.roomManager.updateUserRooms(socket.id, validRooms);

        // Increment Redis counters
        validRooms.forEach(roomId => {
          this.redisService.incrementRoomUsers(roomId);
        });

        // Enviar estado atual dos rooms
        validRooms.forEach(roomId => {
          this.pixelBroadcaster.broadcastRoomState(socket.id, roomId);
          this.pixelBroadcaster.broadcastUserCount(roomId);
        });

        socket.emit('rooms_joined', {
          rooms: validRooms,
          timestamp: Date.now()
        });

        logger.debug('User joined rooms', {
          socketId: socket.id,
          userId: socket.user.id,
          rooms: validRooms
        });

      } catch (error) {
        logger.error('Error joining rooms', { error: error.message, socketId: socket.id });
        socket.emit('error', { message: 'Failed to join rooms' });
      }
    });

    // Sair de rooms específicos
    socket.on('leave_rooms', (data) => {
      try {
        const { rooms } = data;
        
        if (!Array.isArray(rooms)) {
          socket.emit('error', { message: 'Invalid rooms data' });
          return;
        }

        rooms.forEach(roomId => {
          this.roomManager.leaveRoom(socket.id, roomId);
          this.redisService.decrementRoomUsers(roomId);
          this.pixelBroadcaster.broadcastUserCount(roomId);
        });

        socket.emit('rooms_left', {
          rooms,
          timestamp: Date.now()
        });

      } catch (error) {
        logger.error('Error leaving rooms', { error: error.message, socketId: socket.id });
        socket.emit('error', { message: 'Failed to leave rooms' });
      }
    });

    // Obter informações de um room
    socket.on('get_room_info', async (data) => {
      try {
        const { roomId } = data;
        
        if (!this.roomManager.isValidRoom(roomId)) {
          socket.emit('error', { message: 'Invalid room ID' });
          return;
        }

        const [stats, recentPixels] = await Promise.all([
          this.redisService.getRoomStats(roomId),
          this.redisService.getRoomPixels(roomId, 50)
        ]);

        const coordinates = this.roomManager.getRoomCoordinates(roomId);
        const userCount = this.roomManager.getRoomUsers(roomId).size;

        socket.emit('room_info', {
          roomId,
          coordinates,
          userCount,
          stats,
          recentPixels,
          timestamp: Date.now()
        });

      } catch (error) {
        logger.error('Error getting room info', { error: error.message, socketId: socket.id });
        socket.emit('error', { message: 'Failed to get room info' });
      }
    });
  }

  handleViewportEvents(socket) {
    // Atualizar viewport (rooms baseados na área visível)
    socket.on('update_viewport', (data) => {
      try {
        const { minX, maxX, minY, maxY } = data;
        
        // Validar coordenadas
        if (typeof minX !== 'number' || typeof maxX !== 'number' ||
            typeof minY !== 'number' || typeof maxY !== 'number') {
          socket.emit('error', { message: 'Invalid viewport coordinates' });
          return;
        }

        // Validar tamanho do viewport (máximo 10 rooms por dimensão)
        const roomsX = Math.ceil((maxX - minX) / this.roomManager.ROOM_SIZE);
        const roomsY = Math.ceil((maxY - minY) / this.roomManager.ROOM_SIZE);
        
        if (roomsX > 10 || roomsY > 10) {
          socket.emit('error', { message: 'Viewport too large (max: 10000x10000 pixels)' });
          return;
        }

        // Calcular rooms necessários
        const newRooms = this.roomManager.getRoomsInViewport(minX, maxX, minY, maxY);
        
        // Atualizar rooms do usuário
        this.roomManager.updateUserRooms(socket.id, newRooms);

        // Update Redis counters
        const currentRooms = this.roomManager.getUserRooms(socket.id);
        newRooms.forEach(roomId => {
          this.redisService.incrementRoomUsers(roomId);
        });

        socket.emit('viewport_updated', {
          viewport: { minX, maxX, minY, maxY },
          rooms: newRooms,
          timestamp: Date.now()
        });

        // Enviar estado dos novos rooms
        newRooms.forEach(roomId => {
          this.pixelBroadcaster.broadcastRoomState(socket.id, roomId);
        });

        logger.debug('Viewport updated', {
          socketId: socket.id,
          userId: socket.user.id,
          viewport: { minX, maxX, minY, maxY },
          roomCount: newRooms.length
        });

      } catch (error) {
        logger.error('Error updating viewport', { error: error.message, socketId: socket.id });
        socket.emit('error', { message: 'Failed to update viewport' });
      }
    });
  }

  handleDisconnection(socket) {
    socket.on('disconnect', (reason) => {
      logger.info('User disconnected', {
        socketId: socket.id,
        userId: socket.user?.id,
        username: socket.user?.username,
        reason
      });

      // Limpar rooms do usuário
      const userRooms = this.roomManager.getUserRooms(socket.id);
      userRooms.forEach(roomId => {
        this.redisService.decrementRoomUsers(roomId);
        this.pixelBroadcaster.broadcastUserCount(roomId);
      });

      this.roomManager.leaveAllRooms(socket.id);
    });
  }

  setupCleanupJobs() {
    // Cleanup a cada 5 minutos
    setInterval(() => {
      this.redisService.cleanup();
    }, 5 * 60 * 1000);

    // Stats logging a cada minuto
    setInterval(() => {
      const stats = {
        connections: this.io.sockets.sockets.size,
        rooms: this.roomManager.getRoomCount(),
        batches: this.batchManager.getBatchStats()
      };
      
      logger.info('Socket server stats', stats);
    }, 60 * 1000);
  }

  // Método público para broadcast de pixels (chamado pelo REST API)
  broadcastPixel(pixel) {
    this.pixelBroadcaster.broadcastPixel(pixel);
  }

  // Método para obter estatísticas
  getStats() {
    return {
      connections: this.io.sockets.sockets.size,
      rooms: this.roomManager.getRoomStats(),
      broadcaster: this.pixelBroadcaster.getStats(),
      redis: this.redisService.redis.status
    };
  }

  // Graceful shutdown
  async shutdown() {
    logger.info('Shutting down SocketServer...');
    
    // Flush batches pendentes
    this.batchManager.cleanup();
    
    // Fechar conexões
    this.io.close();
    
    logger.info('SocketServer shutdown complete');
  }
}

module.exports = SocketServer;