const { verifyToken } = require('../../shared/utils/jwt-utils');
const UserRepository = require('../../data/repositories/user-repository');

class AdminMiddleware {
  constructor() {
    this.userRepository = new UserRepository();
  }

  requireAdmin = async (req, res, next) => {
    try {
      // Primeiro, verificar se o usuário está autenticado
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];

      if (!token) {
        return res.status(401).json({
          success: false,
          error: 'Token de acesso requerido'
        });
      }

      // Verificar e decodificar token
      const decoded = verifyToken(token);
      
      // Buscar usuário completo para verificar role
      const user = await this.userRepository.findById(decoded.userId);
      
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Usuário não encontrado'
        });
      }

      // Verificar se usuário está ativo
      if (!user.isActive) {
        return res.status(403).json({
          success: false,
          error: 'Conta desativada'
        });
      }

      // Verificar se é admin
      if (user.role !== 'admin') {
        return res.status(403).json({
          success: false,
          error: 'Acesso negado. Permissões de administrador necessárias.'
        });
      }

      // Adicionar dados do admin ao request
      req.user = {
        userId: user.id,
        username: user.username,
        role: user.role
      };
      req.admin = user;

      next();
    } catch (error) {
      if (error.message.includes('Token')) {
        return res.status(403).json({
          success: false,
          error: 'Token inválido ou expirado'
        });
      }

      return res.status(500).json({
        success: false,
        error: 'Erro interno do servidor'
      });
    }
  };

  // Middleware para verificar ban de IP em registros/login
  checkIpBan = async (req, res, next) => {
    try {
      const AdminService = require('../../domain/services/admin-service');
      const adminService = new AdminService();
      
      const ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;
      const banStatus = await adminService.checkIpBanStatus(ip);

      if (banStatus.isBanned) {
        return res.status(403).json({
            success: false,
            error: 'Este IP foi banido do sistema',
            ban: {
              reason: banStatus.ban.reason,
              expiresAt: banStatus.ban.expires_at
            }
          });
        }
   
        next();
      } catch (error) {
        console.error('Erro ao verificar banimento de IP:', error);
        // Em caso de erro, permitir continuar para não quebrar o fluxo
        next();
      }
    };
   
    // Middleware para verificar ban de usuário em requests autenticados
    checkUserBan = async (req, res, next) => {
      try {
        if (!req.user || !req.user.userId) {
          return next(); // Pular se não há usuário autenticado
        }
   
        const AdminService = require('../../domain/services/admin-service');
        const adminService = new AdminService();
        
        const banStatus = await adminService.checkUserBanStatus(req.user.userId);
   
        if (banStatus.isBanned) {
          return res.status(403).json({
            success: false,
            error: 'Sua conta foi banida ou suspensa',
            ban: {
              type: banStatus.ban.type,
              reason: banStatus.ban.reason,
              expiresAt: banStatus.ban.expiresAt
            }
          });
        }
   
        next();
      } catch (error) {
        console.error('Erro ao verificar banimento de usuário:', error);
        next();
      }
    };
   }
   
   // Instância singleton
   const adminMiddleware = new AdminMiddleware();
   
   module.exports = {
    requireAdmin: adminMiddleware.requireAdmin,
    checkIpBan: adminMiddleware.checkIpBan,
    checkUserBan: adminMiddleware.checkUserBan
   };