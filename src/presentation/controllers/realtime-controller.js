const RoomManager = require('../../websocket/room-manager');

class RealtimeController {
  constructor() {
    this.roomManager = new RoomManager();
  }

  // Status geral do sistema
  getStatus = async (req, res, next) => {
    try {
      const realtimeService = req.realtimeService;
      
      if (!realtimeService) {
        return res.status(503).json({
          success: false,
          error: 'Realtime service not available'
        });
      }

      const stats = await realtimeService.getSystemStats();

      res.status(200).json({
        success: true,
        data: {
          status: 'operational',
          ...stats
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // Rooms ativos
  getActiveRooms = async (req, res, next) => {
    try {
      const realtimeService = req.realtimeService;
      const { limit = 20 } = req.query;

      if (!realtimeService) {
        return res.status(503).json({
          success: false,
          error: 'Realtime service not available'
        });
      }

      const activeRooms = await realtimeService.getActiveRooms();

      res.status(200).json({
        success: true,
        data: {
          rooms: activeRooms.slice(0, parseInt(limit)),
          total: activeRooms.length,
          timestamp: Date.now()
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // Estado de um room específico
  getRoomState = async (req, res, next) => {
    try {
      const { roomId } = req.params;
      const realtimeService = req.realtimeService;

      if (!realtimeService) {
        return res.status(503).json({
          success: false,
          error: 'Realtime service not available'
        });
      }

      // Validar room ID
      if (!this.roomManager.isValidRoom(roomId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid room ID format'
        });
      }

      const roomState = await realtimeService.getRoomState(roomId);

      if (!roomState) {
        return res.status(404).json({
          success: false,
          error: 'Room not found or inactive'
        });
      }

      res.status(200).json({
        success: true,
        data: roomState
      });
    } catch (error) {
      next(error);
    }
  };

  // Estatísticas de um room
  getRoomStats = async (req, res, next) => {
    try {
      const { roomId } = req.params;
      const realtimeService = req.realtimeService;

      if (!realtimeService) {
        return res.status(503).json({
          success: false,
          error: 'Realtime service not available'
        });
      }

      if (!this.roomManager.isValidRoom(roomId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid room ID format'
        });
      }

      const [stats, coordinates] = await Promise.all([
        realtimeService.getRoomStats(roomId),
        Promise.resolve(this.roomManager.getRoomCoordinates(roomId))
      ]);

      res.status(200).json({
        success: true,
        data: {
          roomId,
          coordinates,
          stats,
          timestamp: Date.now()
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // Calcular rooms para viewport
  calculateRoomsForViewport = async (req, res, next) => {
    try {
      const { minX, maxX, minY, maxY } = req.query;

      // Validar parâmetros
      if (!minX || !maxX || !minY || !maxY) {
        return res.status(400).json({
          success: false,
          error: 'Missing viewport coordinates (minX, maxX, minY, maxY)'
        });
      }

      const viewport = {
        minX: parseInt(minX),
        maxX: parseInt(maxX),
        minY: parseInt(minY),
        maxY: parseInt(maxY)
      };

      // Validar se viewport não é muito grande
      const pixelWidth = Math.abs(viewport.maxX - viewport.minX);
      const pixelHeight = Math.abs(viewport.maxY - viewport.minY);

      if (pixelWidth > 10000 || pixelHeight > 10000) {
        return res.status(400).json({
          success: false,
          error: 'Viewport too large (max: 10000x10000 pixels)'
        });
      }

      // Calcular rooms
      const rooms = this.roomManager.getRoomsInViewport(
        viewport.minX,
        viewport.maxX,
        viewport.minY,
        viewport.maxY
      );

      // Adicionar coordenadas de cada room
      const roomsWithCoords = rooms.map(roomId => ({
        roomId,
        coordinates: this.roomManager.getRoomCoordinates(roomId)
      }));

      res.status(200).json({
        success: true,
        data: {
          viewport,
          rooms: roomsWithCoords,
          count: rooms.length
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // === ROTAS ADMINISTRATIVAS ===

  getSystemStats = async (req, res, next) => {
    try {
      const realtimeService = req.realtimeService;

      if (!realtimeService) {
        return res.status(503).json({
          success: false,
          error: 'Realtime service not available'
        });
      }

      const stats = await realtimeService.getSystemStats();

      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  };

  broadcastSpecialEvent = async (req, res, next) => {
    try {
      const { eventType, data, roomId } = req.body;
      const realtimeService = req.realtimeService;

      if (!realtimeService) {
        return res.status(503).json({
          success: false,
          error: 'Realtime service not available'
        });
      }

      if (!eventType || !data) {
        return res.status(400).json({
          success: false,
          error: 'eventType and data are required'
        });
      }

      // Validar roomId se fornecido
      if (roomId && !this.roomManager.isValidRoom(roomId)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid room ID format'
        });
      }

      const success = await realtimeService.broadcastSpecialEvent(
        eventType,
        data,
        roomId
      );

      if (success) {
        res.status(200).json({
          success: true,
          message: 'Event broadcasted successfully',
          data: {
            eventType,
            roomId: roomId || 'global',
            timestamp: Date.now()
          }
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to broadcast event'
        });
      }
    } catch (error) {
      next(error);
    }
  };

  forceCleanup = async (req, res, next) => {
    try {
      const realtimeService = req.realtimeService;

      if (!realtimeService) {
        return res.status(503).json({
          success: false,
          error: 'Realtime service not available'
        });
      }

      await realtimeService.cleanup();

      res.status(200).json({
        success: true,
        message: 'Cleanup completed successfully',
        timestamp: Date.now()
      });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = RealtimeController;