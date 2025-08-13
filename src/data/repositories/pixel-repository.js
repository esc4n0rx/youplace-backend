const { supabaseAdmin } = require('../../config/database');
const Pixel = require('../../domain/entities/pixel');

class PixelRepository {
  async create(pixelData) {
    const { data, error } = await supabaseAdmin
      .from('pixels')
      .insert({
        x: pixelData.x,
        y: pixelData.y,
        color: pixelData.color,
        user_id: pixelData.userId
      })
      .select(`
        *,
        users!inner(username)
      `)
      .single();

    if (error) {
      throw new Error(`Erro ao criar pixel: ${error.message}`);
    }

    // Mapear o resultado com username
    const pixelWithUsername = {
      ...data,
      username: data.users.username
    };

    return new Pixel(pixelWithUsername);
  }

  async findByCoordinates(x, y) {
    const { data, error } = await supabaseAdmin
      .from('pixels')
      .select(`
        *,
        users!inner(username)
      `)
      .eq('x', x)
      .eq('y', y)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Erro ao buscar pixels: ${error.message}`);
    }

    return data.map(pixel => new Pixel({
      ...pixel,
      username: pixel.users.username
    }));
  }

  async findByArea(minX, maxX, minY, maxY) {
    const { data, error } = await supabaseAdmin
      .from('pixels')
      .select(`
        *,
        users!inner(username)
      `)
      .gte('x', minX)
      .lte('x', maxX)
      .gte('y', minY)
      .lte('y', maxY)
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(`Erro ao buscar pixels por área: ${error.message}`);
    }

    // Retornar apenas o pixel mais recente por coordenada
    const uniquePixels = new Map();
    data.forEach(pixel => {
      const key = `${pixel.x},${pixel.y}`;
      if (!uniquePixels.has(key)) {
        uniquePixels.set(key, new Pixel({
          ...pixel,
          username: pixel.users.username
        }));
      }
    });

    return Array.from(uniquePixels.values());
  }

  async getLatestByCoordinates(x, y) {
    const { data, error } = await supabaseAdmin
      .from('pixels')
      .select(`
        *,
        users!inner(username)
      `)
      .eq('x', x)
      .eq('y', y)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Erro ao buscar último pixel: ${error.message}`);
    }

    if (!data) return null;

    return new Pixel({
      ...data,
      username: data.users.username
    });
  }

  async countPixelsByUser(userId, since = null) {
    let query = supabaseAdmin
      .from('pixels')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    if (since) {
      query = query.gte('created_at', since.toISOString());
    }

    const { count, error } = await query;

    if (error) {
      throw new Error(`Erro ao contar pixels: ${error.message}`);
    }

    return count || 0;
  }

  async getPixelHistory(x, y, limit = 10) {
    const { data, error } = await supabaseAdmin
      .from('pixels')
      .select(`
        *,
        users!inner(username)
      `)
      .eq('x', x)
      .eq('y', y)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw new Error(`Erro ao buscar histórico: ${error.message}`);
    }

    return data.map(pixel => new Pixel({
      ...pixel,
      username: pixel.users.username
    }));
  }

  async getRecentPixelsByUser(userId, since) {
    const { data, error } = await supabaseAdmin
      .from('pixels')
      .select('x, y, color, created_at')
      .eq('user_id', userId)
      .gte('created_at', since.toISOString())
      .order('created_at', { ascending: true });

    if (error) {
      throw new Error(`Erro ao buscar pixels recentes: ${error.message}`);
    }

    return data;
  }

  async getHourlyActivity(userId, since) {
    // Como a função RPC pode não estar disponível ainda, vamos simular
    try {
      const { data, error } = await supabaseAdmin
        .rpc('get_hourly_pixel_activity', {
          user_id_param: userId,
          since_param: since.toISOString()
        });

      if (error) {
        throw new Error(`Erro ao buscar atividade por hora: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      // Fallback: buscar pixels e agrupar manualmente
      console.warn('Função RPC não disponível, usando fallback');
      
      const { data, error: queryError } = await supabaseAdmin
        .from('pixels')
        .select('created_at')
        .eq('user_id', userId)
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: true });

      if (queryError) {
        throw new Error(`Erro ao buscar pixels para atividade: ${queryError.message}`);
      }

      // Agrupar por hora manualmente
      const hourlyData = {};
      data.forEach(pixel => {
        const hour = new Date(pixel.created_at).getHours();
        hourlyData[hour] = (hourlyData[hour] || 0) + 1;
      });

      return Object.keys(hourlyData).map(hour => ({
        hour: parseInt(hour),
        count: hourlyData[hour]
      }));
    }
  }
}

module.exports = PixelRepository;