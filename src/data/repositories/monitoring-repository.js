const { supabaseAdmin } = require('../../config/database');
const SystemMetric = require('../../domain/entities/system-metric');

class MonitoringRepository {
  async createMetric(metricData) {
    const { data, error } = await supabaseAdmin
      .from('system_metrics')
      .insert({
        metric_type: metricData.metricType,
        value: metricData.value,
        unit: metricData.unit,
        endpoint: metricData.endpoint,
        method: metricData.method,
        status_code: metricData.statusCode,
        metadata: metricData.metadata || {},
        timestamp: metricData.timestamp || new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Erro ao salvar métrica:', error);
      return null;
    }

    return new SystemMetric(data);
  }

  async getMetrics(type, since = null, limit = 1000) {
    let query = supabaseAdmin
      .from('system_metrics')
      .select('*')
      .eq('metric_type', type)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (since) {
      query = query.gte('timestamp', since.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Erro ao buscar métricas: ${error.message}`);
    }

    return data.map(metric => new SystemMetric(metric));
  }

  async getAggregatedMetrics(type, timeframe = '1h', since = null) {
    // Para agregações mais complexas, usaríamos funções SQL
    // Por simplicidade, faremos agregação básica
    let query = supabaseAdmin
      .from('system_metrics')
      .select('value, timestamp')
      .eq('metric_type', type)
      .order('timestamp', { ascending: true });

    if (since) {
      query = query.gte('timestamp', since.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Erro ao buscar métricas agregadas: ${error.message}`);
    }

    return this.aggregateData(data, timeframe);
  }

  aggregateData(data, timeframe) {
    if (!data || data.length === 0) return [];

    const intervals = this.getTimeIntervals(timeframe);
    const aggregated = {};

    data.forEach(item => {
      const intervalKey = this.getIntervalKey(new Date(item.timestamp), timeframe);
      if (!aggregated[intervalKey]) {
        aggregated[intervalKey] = {
          timestamp: intervalKey,
          values: [],
          sum: 0,
          count: 0
        };
      }
      aggregated[intervalKey].values.push(item.value);
      aggregated[intervalKey].sum += item.value;
      aggregated[intervalKey].count += 1;
    });

    return Object.values(aggregated).map(interval => ({
      timestamp: interval.timestamp,
      avg: interval.sum / interval.count,
      min: Math.min(...interval.values),
      max: Math.max(...interval.values),
      count: interval.count
    })).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  getIntervalKey(date, timeframe) {
    switch (timeframe) {
      case '1m':
        return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 
                       date.getHours(), date.getMinutes()).toISOString();
      case '5m':
        return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 
                       date.getHours(), Math.floor(date.getMinutes() / 5) * 5).toISOString();
      case '1h':
        return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 
                       date.getHours()).toISOString();
      case '1d':
        return new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();
      default:
        return date.toISOString();
    }
  }

  getTimeIntervals(timeframe) {
    // Implementação para gerar intervalos de tempo padrão
    const intervals = {
      '1m': 60 * 1000,
      '5m': 5 * 60 * 1000,
      '1h': 60 * 60 * 1000,
      '1d': 24 * 60 * 60 * 1000
    };
    return intervals[timeframe] || intervals['1h'];
  }

  async getSystemStats(since = null) {
    const oneDayAgo = since || new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [responseTimes, errorRates, requestCounts] = await Promise.all([
      this.getAggregatedMetrics('response_time', '1h', oneDayAgo),
      this.getAggregatedMetrics('error_rate', '1h', oneDayAgo),
      this.getAggregatedMetrics('request_count', '1h', oneDayAgo)
    ]);

    return {
      responseTimes,
      errorRates,
      requestCounts,
      period: since ? `desde ${since.toISOString()}` : 'últimas 24h'
    };
  }

  async deleteOldMetrics(olderThanDays = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const { count, error } = await supabaseAdmin
      .from('system_metrics')
      .delete()
      .lt('timestamp', cutoffDate.toISOString());

    if (error) {
      throw new Error(`Erro ao limpar métricas antigas: ${error.message}`);
    }

    return count || 0;
  }
}

module.exports = MonitoringRepository;