const { supabaseAdmin } = require('../../config/database');
const LogEntry = require('../../domain/entities/log-entry');

class LogRepository {
  async create(logData) {
    const { data, error } = await supabaseAdmin
      .from('system_logs')
      .insert({
        level: logData.level,
        message: logData.message,
        type: logData.type,
        user_id: logData.userId,
        ip: logData.ip,
        user_agent: logData.userAgent,
        endpoint: logData.endpoint,
        method: logData.method,
        status_code: logData.statusCode,
        response_time: logData.responseTime,
        metadata: logData.metadata || {}
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao salvar log:', error);
      return null; // Falha silenciosa para não quebrar a aplicação
    }

    return new LogEntry(data);
  }

  async findRecent(limit = 100, filters = {}) {
    let query = supabaseAdmin
      .from('system_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    // Aplicar filtros
    if (filters.level) {
      query = query.eq('level', filters.level);
    }
    if (filters.type) {
      query = query.eq('type', filters.type);
    }
    if (filters.userId) {
      query = query.eq('user_id', filters.userId);
    }
    if (filters.endpoint) {
      query = query.ilike('endpoint', `%${filters.endpoint}%`);
    }
    if (filters.since) {
      query = query.gte('created_at', filters.since.toISOString());
    }
    if (filters.until) {
      query = query.lte('created_at', filters.until.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Erro ao buscar logs: ${error.message}`);
    }

    return data.map(log => new LogEntry(log));
  }

  async countByLevel(since = null) {
    let query = supabaseAdmin
      .from('system_logs')
      .select('level, count(*)', { count: 'exact' })
      .group('level');

    if (since) {
      query = query.gte('created_at', since.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Erro ao contar logs por nível: ${error.message}`);
    }

    return data || [];
  }

  async countByType(since = null) {
    let query = supabaseAdmin
      .from('system_logs')
      .select('type, count(*)', { count: 'exact' })
      .group('type');

    if (since) {
      query = query.gte('created_at', since.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Erro ao contar logs por tipo: ${error.message}`);
    }

    return data || [];
  }

  async getErrorLogs(limit = 50, since = null) {
    let query = supabaseAdmin
      .from('system_logs')
      .select('*')
      .eq('level', 'error')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (since) {
      query = query.gte('created_at', since.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Erro ao buscar logs de erro: ${error.message}`);
    }

    return data.map(log => new LogEntry(log));
  }

  async getSecurityLogs(limit = 50, since = null) {
    let query = supabaseAdmin
      .from('system_logs')
      .select('*')
      .eq('type', 'security')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (since) {
      query = query.gte('created_at', since.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Erro ao buscar logs de segurança: ${error.message}`);
    }

    return data.map(log => new LogEntry(log));
  }

  async getSlowRequests(threshold = 1000, limit = 50) {
    const { data, error } = await supabaseAdmin
      .from('system_logs')
      .select('*')
      .gte('response_time', threshold)
      .order('response_time', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Erro ao buscar requisições lentas: ${error.message}`);
    }

    return data.map(log => new LogEntry(log));
  }

  async getTopEndpoints(limit = 10, since = null) {
    let query = supabaseAdmin
      .from('system_logs')
      .select('endpoint, method, count(*)', { count: 'exact' })
      .not('endpoint', 'is', null)
      .group('endpoint, method')
      .order('count', { ascending: false })
      .limit(limit);

    if (since) {
      query = query.gte('created_at', since.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Erro ao buscar endpoints mais acessados: ${error.message}`);
    }

    return data || [];
  }

  async deleteOldLogs(olderThanDays = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const { count, error } = await supabaseAdmin
      .from('system_logs')
      .delete()
      .lt('created_at', cutoffDate.toISOString());

    if (error) {
      throw new Error(`Erro ao limpar logs antigos: ${error.message}`);
    }

    return count || 0;
  }
}

module.exports = LogRepository;