const UserRepository = require('../../data/repositories/user-repository');
const AdminRepository = require('../../data/repositories/admin-repository');
const CreditService = require('./credit-service');
const LoggingService = require('./logging-service');

class AdminService {
  constructor() {
    this.userRepository = new UserRepository();
    this.adminRepository = new AdminRepository();
    this.creditService = new CreditService();
    this.loggingService = new LoggingService();
  }

  // === GESTÃO DE USUÁRIOS ===

  async getUsers(page = 1, limit = 50, filters = {}) {
    const offset = (page - 1) * limit;
    
    const [users, totalCount] = await Promise.all([
      this.userRepository.findAll(limit, offset, filters),
      this.userRepository.countUsers(filters)
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return {
      users: users.map(user => user.toJSON()),
      pagination: {
        page,
        limit,
        totalCount,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };
  }

  async getUserDetails(userId) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    const [banHistory, activeBan] = await Promise.all([
      this.adminRepository.getBanHistory(userId),
      this.adminRepository.findActiveBanByUserId(userId)
    ]);

    return {
      user: user.toJSON(),
      banHistory,
      activeBan: activeBan ? activeBan.toJSON() : null
    };
  }

  // === BANIMENTOS E SUSPENSÕES ===

  async banUser(adminId, userId, reason, type = 'ban', duration = null) {
    // Verificar se usuário existe
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    // Verificar se já está banido
    const existingBan = await this.adminRepository.findActiveBanByUserId(userId);
    if (existingBan) {
      throw new Error('Usuário já possui banimento ativo');
    }

    // Calcular data de expiração se for suspensão temporária
    let expiresAt = null;
    if (type === 'suspend' && duration) {
      expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + duration);
    }

    // Criar banimento
    const ban = await this.adminRepository.createBan({
      userId,
      adminId,
      reason,
      type,
      expiresAt
    });

    // Desativar usuário
    await this.userRepository.updateUserStatus(userId, false);

    // Banir IP se for banimento permanente
    if (type === 'ban' && user.registrationIp) {
      await this.adminRepository.createIpBan({
        ip: user.registrationIp,
        adminId,
        reason: `IP banido junto com usuário: ${user.username}`,
        expiresAt: null
      });
    }

    // Log da ação administrativa
    await this.adminRepository.logAdminAction({
      adminId,
      targetUserId: userId,
      action: type,
      reason,
      metadata: {
        duration,
        userRegistrationIp: user.registrationIp,
        userEmail: user.email
      }
    });

    // Log de auditoria
    await this.loggingService.logAudit(
      `Usuário ${type === 'ban' ? 'banido' : 'suspenso'}: ${user.username}`,
      adminId,
      {
        targetUserId: userId,
        targetUsername: user.username,
        reason,
        type,
        duration
      }
    );

    return {
      ban: ban.toJSON(),
      message: `Usuário ${type === 'ban' ? 'banido' : 'suspenso'} com sucesso`
    };
  }

  async unbanUser(adminId, userId, reason) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    const activeBan = await this.adminRepository.findActiveBanByUserId(userId);
    if (!activeBan) {
      throw new Error('Usuário não possui banimento ativo');
    }

    // Desativar banimento
    await this.adminRepository.deactivateBan(activeBan.id);

    // Reativar usuário
    await this.userRepository.updateUserStatus(userId, true);

    // Remover banimento de IP se existir
    if (user.registrationIp) {
      await this.adminRepository.deactivateIpBan(user.registrationIp);
    }

    // Log da ação
    await this.adminRepository.logAdminAction({
      adminId,
      targetUserId: userId,
      action: 'unban',
      reason,
      metadata: {
        previousBanType: activeBan.type,
        unbannedIp: user.registrationIp
      }
    });

    await this.loggingService.logAudit(
      `Usuário desbanido: ${user.username}`,
      adminId,
      {
        targetUserId: userId,
        targetUsername: user.username,
        reason
      }
    );

    return {
      message: 'Usuário desbanido com sucesso'
    };
  }

  // === GESTÃO DE CRÉDITOS ===

  async adjustUserCredits(adminId, userId, amount, reason) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('Usuário não encontrado');
    }

    const action = amount > 0 ? 'add_credits' : 'remove_credits';
    const description = `${action === 'add_credits' ? 'Créditos adicionados' : 'Créditos removidos'} pelo admin: ${reason}`;

    if (amount > 0) {
      await this.creditService.addCredits(userId, amount, 'admin_adjustment', description);
    } else {
      const currentCredits = await this.creditService.getUserCredits(userId);
      const newCredits = Math.max(0, currentCredits + amount); // Não permitir créditos negativos
      await this.userRepository.updateUserCredits(userId, newCredits);
      
      // Criar transação manual de débito
      await this.creditService.creditRepository.createTransaction({
        userId,
        amount,
        type: 'admin_adjustment',
        description
      });
    }

    // Log da ação
    await this.adminRepository.logAdminAction({
      adminId,
      targetUserId: userId,
      action,
      reason,
      metadata: {
        amount,
        previousCredits: user.credits
      }
    });

    await this.loggingService.logAudit(
      `Créditos ${amount > 0 ? 'adicionados' : 'removidos'} para ${user.username}: ${Math.abs(amount)}`,
      adminId,
      {
        targetUserId: userId,
        targetUsername: user.username,
        amount,
        reason
      }
    );

    return {
      message: `Créditos ${amount > 0 ? 'adicionados' : 'removidos'} com sucesso`,
      amount: Math.abs(amount),
      newCredits: await this.creditService.getUserCredits(userId)
    };
  }

  // === VERIFICAÇÕES DE SEGURANÇA ===

  async checkUserBanStatus(userId) {
    const activeBan = await this.adminRepository.findActiveBanByUserId(userId);
    
    if (!activeBan) {
      return { isBanned: false };
    }

    // Verificar se banimento expirou
    if (activeBan.expiresAt && activeBan.isExpired()) {
      // Auto-desban por expiração
      await this.adminRepository.deactivateBan(activeBan.id);
      await this.userRepository.updateUserStatus(userId, true);
      
      return { isBanned: false, wasExpired: true };
    }

    return {
      isBanned: true,
      ban: activeBan.toJSON()
    };
  }

  async checkIpBanStatus(ip) {
    const activeBan = await this.adminRepository.findActiveBanByIp(ip);
    
    if (!activeBan) {
      return { isBanned: false };
    }

    // Verificar se banimento expirou
    if (activeBan.expires_at && new Date() > new Date(activeBan.expires_at)) {
      await this.adminRepository.deactivateIpBan(ip);
      return { isBanned: false, wasExpired: true };
    }

    return {
      isBanned: true,
      ban: activeBan
    };
  }

  // === RELATÓRIOS E ESTATÍSTICAS ===

  async getAdminDashboard() {
    const [stats, recentActions] = await Promise.all([
      this.adminRepository.getAdminStats(),
      this.adminRepository.getAdminActions(10, 0)
    ]);

    return {
      stats,
      recentActions
    };
  }

  async getAdminActions(page = 1, limit = 50, filters = {}) {
    const offset = (page - 1) * limit;
    const actions = await this.adminRepository.getAdminActions(limit, offset, filters);

    return {
      actions,
      pagination: {
        page,
        limit,
        hasNext: actions.length === limit,
        hasPrev: page > 1
      }
    };
  }
}

module.exports = AdminService;