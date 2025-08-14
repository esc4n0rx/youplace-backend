const { supabaseAdmin } = require('../../config/database');
const UserBan = require('../../domain/entities/user-ban');
const AdminAction = require('../../domain/entities/admin-action');

class AdminRepository {
  // === GESTÃO DE BANIMENTOS ===

  async createBan(banData) {
    const { data, error } = await supabaseAdmin
      .from('user_bans')
      .insert({
        user_id: banData.userId,
        admin_id: banData.adminId,
        reason: banData.reason,
        type: banData.type,
        is_active: true,
        expires_at: banData.expiresAt
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao criar banimento: ${error.message}`);
    }

    return new UserBan(data);
  }

  async findActiveBanByUserId(userId) {
    const { data, error } = await supabaseAdmin
      .from('user_bans')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Erro ao buscar banimento: ${error.message}`);
    }

    return data ? new UserBan(data) : null;
  }

  async findActiveBanByIp(ip) {
    const { data, error } = await supabaseAdmin
      .from('ip_bans')
      .select('*')
      .eq('ip_address', ip)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Erro ao buscar banimento por IP: ${error.message}`);
    }

    return data;
  }

  async createIpBan(ipBanData) {
    const { data, error } = await supabaseAdmin
      .from('ip_bans')
      .insert({
        ip_address: ipBanData.ip,
        admin_id: ipBanData.adminId,
        reason: ipBanData.reason,
        is_active: true,
        expires_at: ipBanData.expiresAt
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao criar banimento de IP: ${error.message}`);
    }

    return data;
  }

  async deactivateBan(banId) {
    const { data, error } = await supabaseAdmin
      .from('user_bans')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', banId)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao desativar banimento: ${error.message}`);
    }

    return new UserBan(data);
  }

  async deactivateIpBan(ip) {
    const { data, error } = await supabaseAdmin
      .from('ip_bans')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('ip_address', ip)
      .eq('is_active', true);

    if (error) {
      throw new Error(`Erro ao desativar banimento de IP: ${error.message}`);
    }

    return data;
  }

  async getBanHistory(userId, limit = 10) {
    const { data, error } = await supabaseAdmin
      .from('user_bans')
      .select(`
        *,
        admin:users!user_bans_admin_id_fkey(username)
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Erro ao buscar histórico de banimentos: ${error.message}`);
    }

    return data.map(ban => ({
      ...new UserBan(ban).toJSON(),
      adminUsername: ban.admin.username
    }));
  }

  // === LOG DE AÇÕES ADMINISTRATIVAS ===

  async logAdminAction(actionData) {
    const { data, error } = await supabaseAdmin
      .from('admin_actions')
      .insert({
        admin_id: actionData.adminId,
        target_user_id: actionData.targetUserId,
        action: actionData.action,
        reason: actionData.reason,
        metadata: actionData.metadata || {}
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao registrar ação administrativa: ${error.message}`);
    }

    return new AdminAction(data);
  }

  async getAdminActions(limit = 50, offset = 0, filters = {}) {
    let query = supabaseAdmin
      .from('admin_actions')
      .select(`
        *,
        admin:users!admin_actions_admin_id_fkey(username),
        target_user:users!admin_actions_target_user_id_fkey(username)
      `)
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    if (filters.adminId) {
      query = query.eq('admin_id', filters.adminId);
    }
    if (filters.targetUserId) {
      query = query.eq('target_user_id', filters.targetUserId);
    }
    if (filters.action) {
      query = query.eq('action', filters.action);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Erro ao buscar ações administrativas: ${error.message}`);
    }

    return data.map(action => ({
      ...new AdminAction(action).toJSON(),
      adminUsername: action.admin.username,
      targetUsername: action.target_user.username
    }));
  }

  // === ESTATÍSTICAS ADMINISTRATIVAS ===

  async getAdminStats() {
    const [totalUsers, activeUsers, bannedUsers, suspendedUsers, totalActions] = await Promise.all([
      this.countUsers(),
      this.countUsers({ isActive: true }),
      this.countBans({ type: 'ban', isActive: true }),
      this.countBans({ type: 'suspend', isActive: true }),
      this.countAdminActions()
    ]);

    return {
      users: {
        total: totalUsers,
        active: activeUsers,
        banned: bannedUsers,
        suspended: suspendedUsers
      },
      actions: {
        total: totalActions
      }
    };
  }

  async countUsers(filters = {}) {
    let query = supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true });

    if (filters.isActive !== undefined) {
      query = query.eq('is_active', filters.isActive);
    }

    const { count, error } = await query;

    if (error) {
      throw new Error(`Erro ao contar usuários: ${error.message}`);
    }

    return count || 0;
  }

  async countBans(filters = {}) {
    let query = supabaseAdmin
      .from('user_bans')
      .select('*', { count: 'exact', head: true });

    if (filters.type) {
      query = query.eq('type', filters.type);
    }
    if (filters.isActive !== undefined) {
      query = query.eq('is_active', filters.isActive);
    }

    const { count, error } = await query;

    if (error) {
      throw new Error(`Erro ao contar banimentos: ${error.message}`);
    }

    return count || 0;
  }

  async countAdminActions(since = null) {
    let query = supabaseAdmin
      .from('admin_actions')
      .select('*', { count: 'exact', head: true });

    if (since) {
      query = query.gte('created_at', since.toISOString());
    }

    const { count, error } = await query;

    if (error) {
      throw new Error(`Erro ao contar ações administrativas: ${error.message}`);
    }

    return count || 0;
  }
}

module.exports = AdminRepository;