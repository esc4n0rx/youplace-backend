const AdminService = require('../../domain/services/admin-service');
const { auditMiddleware } = require('../middlewares/logging-middleware');
const { userActionMonitoring } = require('../middlewares/monitoring-middleware');

class AdminController {
  constructor() {
    this.adminService = new AdminService();
  }

  // === DASHBOARD E ESTATÍSTICAS ===

  getDashboard = async (req, res, next) => {
    try {
      const dashboard = await this.adminService.getAdminDashboard();

      res.status(200).json({
        success: true,
        data: dashboard
      });
    } catch (error) {
      next(error);
    }
  };

  // === GESTÃO DE USUÁRIOS ===

  getUsers = async (req, res, next) => {
    try {
      const {
        page = 1,
        limit = 50,
        role,
        isActive,
        search
      } = req.query;

      const filters = {};
      if (role) filters.role = role;
      if (isActive !== undefined) filters.isActive = isActive === 'true';
      if (search) filters.search = search;

      const result = await this.adminService.getUsers(
        parseInt(page),
        parseInt(limit),
        filters
      );

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  };

  getUserDetails = async (req, res, next) => {
    try {
      const { userId } = req.params;
      
      const userDetails = await this.adminService.getUserDetails(userId);

      res.status(200).json({
        success: true,
        data: userDetails
      });
    } catch (error) {
      next(error);
    }
  };

  // === BANIMENTOS E SUSPENSÕES ===

  banUser = async (req, res, next) => {
    // Aplicar monitoramento de ação administrativa
    await userActionMonitoring('admin_ban_user')(req, res, () => {});
    
    try {
      const { userId } = req.params;
      const { reason, type = 'ban', duration } = req.body;
      const adminId = req.user.userId;

      const result = await this.adminService.banUser(
        adminId,
        userId,
        reason,
        type,
        duration
      );

      res.status(200).json({
        success: true,
        message: result.message,
        data: result.ban
      });
    } catch (error) {
      next(error);
    }
  };

  suspendUser = async (req, res, next) => {
    await userActionMonitoring('admin_suspend_user')(req, res, () => {});
    
    try {
      const { userId } = req.params;
      const { reason, duration = 24 } = req.body; // duração padrão: 24h

      const adminId = req.user.userId;

      const result = await this.adminService.banUser(
        adminId,
        userId,
        reason,
        'suspend',
        parseInt(duration)
      );

      res.status(200).json({
        success: true,
        message: result.message,
        data: result.ban
      });
    } catch (error) {
      next(error);
    }
  };

  unbanUser = async (req, res, next) => {
    await userActionMonitoring('admin_unban_user')(req, res, () => {});
    
    try {
      const { userId } = req.params;
      const { reason } = req.body;
      const adminId = req.user.userId;

      const result = await this.adminService.unbanUser(adminId, userId, reason);

      res.status(200).json({
        success: true,
        message: result.message
      });
    } catch (error) {
      next(error);
    }
  };

  // === GESTÃO DE CRÉDITOS ===

  adjustCredits = async (req, res, next) => {
    await userActionMonitoring('admin_adjust_credits')(req, res, () => {});
    
    try {
      const { userId } = req.params;
      const { amount, reason } = req.body;
      const adminId = req.user.userId;

      if (!amount || amount === 0) {
        return res.status(400).json({
          success: false,
          error: 'Quantidade de créditos deve ser diferente de zero'
        });
      }

      const result = await this.adminService.adjustUserCredits(
        adminId,
        userId,
        parseInt(amount),
        reason
      );

      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          amount: result.amount,
          newCredits: result.newCredits
        }
      });
    } catch (error) {
      next(error);
    }
  };

  // === LOGS E AUDITORIA ===

  getAdminActions = async (req, res, next) => {
    try {
      const {
        page = 1,
        limit = 50,
        adminId,
        targetUserId,
        action
      } = req.query;

      const filters = {};
      if (adminId) filters.adminId = adminId;
      if (targetUserId) filters.targetUserId = targetUserId;
      if (action) filters.action = action;

      const result = await this.adminService.getAdminActions(
        parseInt(page),
        parseInt(limit),
        filters
      );

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  };

  // === RELATÓRIOS ===

  generateUserReport = async (req, res, next) => {
    try {
      const { format = 'json', timeframe = '30d' } = req.query;
      
      // Buscar dados para relatório
      const [activeUsers, bannedUsers, suspendedUsers, recentActions] = await Promise.all([
        this.adminService.getUsers(1, 1000, { isActive: true }),
        this.adminService.getUsers(1, 1000, { isActive: false }),
        this.adminService.adminRepository.countBans({ type: 'suspend', isActive: true }),
        this.adminService.getAdminActions(1, 100)
      ]);

      const report = {
        generatedAt: new Date().toISOString(),
        generatedBy: req.user.username,
        timeframe,
        summary: {
          totalActiveUsers: activeUsers.pagination.totalCount,
          totalBannedUsers: bannedUsers.pagination.totalCount,
          totalSuspendedUsers: suspendedUsers,
          totalAdminActions: recentActions.actions.length
        },
        details: {
          recentActions: recentActions.actions.slice(0, 20)
        }
      };

      if (format === 'csv') {
        // Converter para CSV
        const csvData = this.convertReportToCSV(report);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=user-report-${new Date().toISOString().split('T')[0]}.csv`);
        res.send(csvData);
      } else {
        res.status(200).json({
          success: true,
          data: report
        });
      }
    } catch (error) {
      next(error);
    }
  };

  // === MÉTODOS AUXILIARES ===

  convertReportToCSV(report) {
    const headers = 'Data,Admin,Ação,Usuário Alvo,Motivo\n';
    const rows = report.details.recentActions.map(action => 
      `${action.createdAt},${action.adminUsername},${action.action},${action.targetUsername},"${action.reason}"`
    ).join('\n');

    return headers + rows;
  }

  // === VERIFICAÇÕES DE STATUS ===

  checkUserBanStatus = async (req, res, next) => {
    try {
      const { userId } = req.params;
      
      const banStatus = await this.adminService.checkUserBanStatus(userId);

      res.status(200).json({
        success: true,
        data: banStatus
      });
    } catch (error) {
      next(error);
    }
  };

  checkIpBanStatus = async (req, res, next) => {
    try {
      const { ip } = req.params;
      
      const banStatus = await this.adminService.checkIpBanStatus(ip);

      res.status(200).json({
        success: true,
        data: banStatus
      });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = AdminController;