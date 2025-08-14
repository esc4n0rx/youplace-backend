const logger = require('../config/logger');

class RoomManager {
  constructor() {
    this.rooms = new Map(); // roomId -> Set<socketId>
    this.userRooms = new Map(); // socketId -> Set<roomId>
    this.ROOM_SIZE = 1000; // pixels por room
  }

  // === CÁLCULO DE ROOMS ===

  getRoomId(x, y) {
    const roomX = Math.floor(x / this.ROOM_SIZE);
    const roomY = Math.floor(y / this.ROOM_SIZE);
    return `room_${roomX}_${roomY}`;
  }

  getRoomCoordinates(roomId) {
    const parts = roomId.split('_');
    const roomX = parseInt(parts[1]);
    const roomY = parseInt(parts[2]);
    
    return {
      minX: roomX * this.ROOM_SIZE,
      maxX: (roomX + 1) * this.ROOM_SIZE - 1,
      minY: roomY * this.ROOM_SIZE,
      maxY: (roomY + 1) * this.ROOM_SIZE - 1,
      centerX: roomX * this.ROOM_SIZE + this.ROOM_SIZE / 2,
      centerY: roomY * this.ROOM_SIZE + this.ROOM_SIZE / 2
    };
  }

  getRoomsInViewport(minX, maxX, minY, maxY) {
    const rooms = [];
    
    const startRoomX = Math.floor(minX / this.ROOM_SIZE);
    const endRoomX = Math.floor(maxX / this.ROOM_SIZE);
    const startRoomY = Math.floor(minY / this.ROOM_SIZE);
    const endRoomY = Math.floor(maxY / this.ROOM_SIZE);

    for (let roomX = startRoomX; roomX <= endRoomX; roomX++) {
      for (let roomY = startRoomY; roomY <= endRoomY; roomY++) {
        rooms.push(`room_${roomX}_${roomY}`);
      }
    }

    return rooms;
  }

  getAdjacentRooms(roomId, radius = 1) {
    const parts = roomId.split('_');
    const centerX = parseInt(parts[1]);
    const centerY = parseInt(parts[2]);
    
    const rooms = [];
    
    for (let x = centerX - radius; x <= centerX + radius; x++) {
      for (let y = centerY - radius; y <= centerY + radius; y++) {
        rooms.push(`room_${x}_${y}`);
      }
    }
    
    return rooms;
  }

  // === GESTÃO DE USUÁRIOS ===

  joinRoom(socketId, roomId) {
    // Adicionar socket ao room
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, new Set());
    }
    this.rooms.get(roomId).add(socketId);

    // Adicionar room ao socket
    if (!this.userRooms.has(socketId)) {
      this.userRooms.set(socketId, new Set());
    }
    this.userRooms.get(socketId).add(roomId);

    logger.debug('User joined room', { socketId, roomId, roomSize: this.rooms.get(roomId).size });
  }

  leaveRoom(socketId, roomId) {
    // Remover socket do room
    if (this.rooms.has(roomId)) {
      this.rooms.get(roomId).delete(socketId);
      if (this.rooms.get(roomId).size === 0) {
        this.rooms.delete(roomId);
      }
    }

    // Remover room do socket
    if (this.userRooms.has(socketId)) {
      this.userRooms.get(socketId).delete(roomId);
      if (this.userRooms.get(socketId).size === 0) {
        this.userRooms.delete(socketId);
      }
    }

    logger.debug('User left room', { socketId, roomId });
  }

  leaveAllRooms(socketId) {
    if (this.userRooms.has(socketId)) {
      const userRoomsSet = this.userRooms.get(socketId);
      for (const roomId of userRoomsSet) {
        this.leaveRoom(socketId, roomId);
      }
    }
  }

  updateUserRooms(socketId, newRooms) {
    const currentRooms = this.userRooms.get(socketId) || new Set();
    
    // Sair de rooms que não estão mais na lista
    for (const roomId of currentRooms) {
      if (!newRooms.includes(roomId)) {
        this.leaveRoom(socketId, roomId);
      }
    }

    // Entrar em novos rooms
    for (const roomId of newRooms) {
      if (!currentRooms.has(roomId)) {
        this.joinRoom(socketId, roomId);
      }
    }
  }

  // === QUERIES ===

  getRoomUsers(roomId) {
    return this.rooms.get(roomId) || new Set();
  }

  getUserRooms(socketId) {
    return Array.from(this.userRooms.get(socketId) || new Set());
  }

  getRoomCount() {
    return this.rooms.size;
  }

  getTotalUsers() {
    return this.userRooms.size;
  }

  getRoomStats() {
    const stats = {};
    for (const [roomId, users] of this.rooms.entries()) {
      stats[roomId] = {
        userCount: users.size,
        coordinates: this.getRoomCoordinates(roomId)
      };
    }
    return stats;
  }

  // === VALIDAÇÃO ===

  isValidRoom(roomId) {
    return /^room_-?\d+_-?\d+$/.test(roomId);
  }

  isPixelInRoom(x, y, roomId) {
    const pixelRoom = this.getRoomId(x, y);
    return pixelRoom === roomId;
  }
}

module.exports = RoomManager;