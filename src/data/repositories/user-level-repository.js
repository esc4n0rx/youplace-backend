const { supabaseAdmin } = require('../../config/database');
const UserLevel = require('../../domain/entities/user-level');

class UserLevelRepository {
  async findByUserId(userId) {
    const { data, error } = await supabaseAdmin
      .from('user_levels')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Erro ao buscar nível do usuário: ${error.message}`);
    }

    return data ? new UserLevel(data) : null;
  }

  async create(levelData) {
    const { data, error } = await supabaseAdmin
      .from('user_levels')
      .insert({
        user_id: levelData.userId,
        current_level: levelData.currentLevel,
        total_pixels_painted: levelData.totalPixelsPainted,
        pixels_for_current_level: levelData.pixelsForCurrentLevel,
        pixels_for_next_level: levelData.pixelsForNextLevel,
        title: levelData.title,
        experience_points: levelData.experiencePoints,
        last_level_up: levelData.lastLevelUp
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao criar nível do usuário: ${error.message}`);
    }

    return new UserLevel(data);
  }

  async update(userId, levelData) {
    const updateData = {
      current_level: levelData.currentLevel,
      total_pixels_painted: levelData.totalPixelsPainted,
      pixels_for_current_level: levelData.pixelsForCurrentLevel,
      pixels_for_next_level: levelData.pixelsForNextLevel,
      title: levelData.title,
      experience_points: levelData.experiencePoints,
      updated_at: new Date().toISOString()
    };

    // Adicionar timestamp de level up se houve mudança de nível
    if (levelData.lastLevelUp) {
      updateData.last_level_up = levelData.lastLevelUp;
    }

    const { data, error } = await supabaseAdmin
      .from('user_levels')
      .update(updateData)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao atualizar nível do usuário: ${error.message}`);
    }

    return new UserLevel(data);
  }

  async incrementPixelCount(userId, pixelCount = 1) {
    // Usar uma transação para garantir consistência
    const { data, error } = await supabaseAdmin
      .from('user_levels')
      .update({
        total_pixels_painted: supabaseAdmin.raw(`total_pixels_painted + ${pixelCount}`),
        updated_at: new Date().toISOString()
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao incrementar pixels: ${error.message}`);
    }

    return new UserLevel(data);
  }

  async getTopUsers(limit = 10) {
    const { data, error } = await supabaseAdmin
      .from('user_levels')
      .select(`
        *,
        users!inner(username)
      `)
      .order('current_level', { ascending: false })
      .order('total_pixels_painted', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Erro ao buscar ranking: ${error.message}`);
    }

    return data.map(level => ({
      ...new UserLevel(level).toJSON(),
      username: level.users.username
    }));
  }

  async getUserRanking(userId) {
    // Buscar ranking do usuário específico
    const { data: userLevel } = await supabaseAdmin
      .from('user_levels')
      .select('current_level, total_pixels_painted')
      .eq('user_id', userId)
      .single();

    if (!userLevel) {
      return null;
    }

    // Contar quantos usuários estão acima
    const { count, error } = await supabaseAdmin
      .from('user_levels')
      .select('*', { count: 'exact', head: true })
      .or(`current_level.gt.${userLevel.current_level},and(current_level.eq.${userLevel.current_level},total_pixels_painted.gt.${userLevel.total_pixels_painted})`);

    if (error) {
      throw new Error(`Erro ao calcular ranking: ${error.message}`);
    }

    return (count || 0) + 1; // +1 porque ranking começa em 1
  }

  async getLevelStatistics() {
    const { data, error } = await supabaseAdmin
      .from('user_levels')
      .select(`
        current_level,
        count(*) as user_count
      `)
      .group('current_level')
      .order('current_level');

    if (error) {
      throw new Error(`Erro ao buscar estatísticas: ${error.message}`);
    }

    return data || [];
  }
}

module.exports = UserLevelRepository;