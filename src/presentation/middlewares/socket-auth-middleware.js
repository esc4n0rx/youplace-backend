const { verifyToken } = require('../../shared/utils/jwt-utils');
const UserRepository = require('../../data/repositories/user-repository');
const logger = require('../../config/logger');

class SocketAuthMiddleware {
  constructor() {
    this.userRepository = new UserRepository();
  }

  authenticate() {
    return async (socket, next) => {
      try {
        // Extrair token do handshake
        const token = socket.handshake.auth.token || 
                     socket.handshake.headers.authorization?.split(' ')[1];

        if (!token) {
          logger.warn('Socket connection without token', { 
            socketId: socket.id,
            ip: socket.handshake.address
          });
          return next(new Error('Authentication required'));
        }

        // Verificar e decodificar token
        const decoded = verifyToken(token);
        
        // Buscar usuário
        const user = await this.userRepository.findById(decoded.userId);
        if (!user) {
          logger.warn('Socket connection with invalid user', { 
            socketId: socket.id,
            userId: decoded.userId 
          });
          return next(new Error('User not found'));
        }

        // Verificar se usuário está ativo
        if (!user.isActive) {
          logger.warn('Socket connection from banned user', { 
            socketId: socket.id,
            userId: user.id,
            username: user.username 
          });
          return next(new Error('Account suspended'));
        }

        // Adicionar dados do usuário ao socket
        socket.user = {
          id: user.id,
          username: user.username,
          role: user.role,
          credits: user.credits,
          isGoogleUser: user.isGoogleUser
        };

        logger.info('Socket authenticated', {
          socketId: socket.id,
          userId: user.id,
          username: user.username,
          ip: socket.handshake.address
        });

        next();
      } catch (error) {
        logger.error('Socket authentication error', {
          socketId: socket.id,
          error: error.message,
          ip: socket.handshake.address
        });
        
        if (error.message.includes('Token')) {
          next(new Error('Invalid or expired token'));
        } else {
          next(new Error('Authentication failed'));
        }
      }
    };
  }

  // Middleware para verificar permissões específicas
  requireRole(role) {
    return (socket, next) => {
      if (!socket.user) {
        return next(new Error('Authentication required'));
      }

      if (socket.user.role !== role) {
        logger.warn('Socket access denied - insufficient role', {
          socketId: socket.id,
          userId: socket.user.id,
          userRole: socket.user.role,
          requiredRole: role
        });
        return next(new Error('Insufficient permissions'));
      }

      next();
    };
  }

  // Middleware para rate limiting por usuário
  rateLimit(maxEventsPerMinute = 60) {
    const userEventCounts = new Map();

    return (socket, next) => {
      if (!socket.user) {
        return next(new Error('Authentication required'));
      }

      const userId = socket.user.id;
      const now = Date.now();
      const minute = Math.floor(now / 60000);
      const key = `${userId}_${minute}`;

      const currentCount = userEventCounts.get(key) || 0;
      
      if (currentCount >= maxEventsPerMinute) {
        logger.warn('Socket rate limit exceeded', {
          socketId: socket.id,
          userId,
          count: currentCount,
          limit: maxEventsPerMinute
        });
        return next(new Error('Rate limit exceeded'));
      }

      userEventCounts.set(key, currentCount + 1);

      // Cleanup old entries
      if (Math.random() < 0.1) { // 10% chance
        for (const [k, v] of userEventCounts.entries()) {
          const [, entryMinute] = k.split('_');
          if (minute - parseInt(entryMinute) > 5) { // Remove entries older than 5 minutes
            userEventCounts.delete(k);
          }
        }
      }

      next();
    };
  }
}

module.exports = SocketAuthMiddleware;