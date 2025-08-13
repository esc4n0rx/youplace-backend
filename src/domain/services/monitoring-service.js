const MonitoringRepository = require('../../data/repositories/monitoring-repository');
const LoggingService = require('./logging-service');
const { performance } = require('perf_hooks');

class MonitoringService {
  constructor() {
    this.monitoringRepository = new MonitoringRepository();
    this.loggingService = new LoggingService();
    
    // Cache para métricas em tempo real
    this.metricsBuffer = new Map();
    this.bufferFlushInterval = 30000; // 30 segundos
    
    this.startMetricsBuffer();
  }

  startMetricsBuffer() {
    // Flush periódico do buffer de métricas
    setInterval(() => {
      this.flushMetricsBuffer();
    }, this.bufferFlushInterval);
  }

  async recordMetric(type, value, unit, metadata = {}) {
    try {
      const metric = {
        metricType: type,
        value,
        unit,
        metadata,
        timestamp: new Date().toISOString(),
        ...metadata
      };

      // Para métricas críticas, salvar imediatamente
      const criticalMetrics = ['error_rate', 'system_failure'];
      if (criticalMetrics.includes(type)) {
        await this.monitoringRepository.createMetric(metric);
      } else {
        // Buffer para métricas normais
        this.addToBuffer(metric);
      }

      return true;
    } catch (error) {
      console.error('Erro ao registrar métrica:', error);
      return false;
    }
  }

  addToBuffer(metric) {
    const bufferKey = `${metric.metricType}_${metric.endpoint || 'global'}`;
    if (!this.metricsBuffer.has(bufferKey)) {
      this.metricsBuffer.set(bufferKey, []);
    }
    this.metricsBuffer.get(bufferKey).push(metric);
  }

  async flushMetricsBuffer() {
    if (this.metricsBuffer.size === 0) return;

    try {
      const allMetrics = [];
      for (const [key, metrics] of this.metricsBuffer.entries()) {
        allMetrics.push(...metrics);
      }

      // Salvar métricas em lote
      const savePromises = allMetrics.map(metric => 
        this.monitoringRepository.createMetric(metric)
      );
      
      await Promise.allSettled(savePromises);
      
      // Limpar buffer
      this.metricsBuffer.clear();
      
      console.log(`📊 Flush de ${allMetrics.length} métricas concluído`);
    } catch (error) {
      console.error('Erro no flush de métricas:', error);
    }
  }

  async recordResponseTime(endpoint, method, responseTime, statusCode, userId = null) {
    const metadata = { endpoint, method, statusCode };
    if (userId) metadata.userId = userId;

    await this.recordMetric('response_time', responseTime, 'ms', metadata);

    // Log de performance para requisições lentas
    if (responseTime > 1000) {
      await this.loggingService.logPerformance(
        `Requisição lenta detectada: ${method} ${endpoint}`,
        responseTime,
        endpoint,
        method,
        { statusCode, userId }
      );
    }
  }

  async recordError(endpoint, method, statusCode, errorMessage, userId = null) {
    const metadata = { endpoint, method, statusCode, errorMessage };
    if (userId) metadata.userId = userId;

    await this.recordMetric('error_count', 1, 'count', metadata);
    
    // Log de segurança para erros críticos
    if (statusCode >= 500) {
      await this.loggingService.logSecurity(
        `Erro interno do servidor: ${method} ${endpoint}`,
        null,
        null,
        { statusCode, errorMessage, userId }
      );
    }
  }

  async recordRequest(endpoint, method, statusCode, userId = null) {
    const metadata = { endpoint, method, statusCode };
    if (userId) metadata.userId = userId;

    await this.recordMetric('request_count', 1, 'count', metadata);
  }

  async recordUserAction(action, userId, metadata = {}) {
    await this.recordMetric('user_action', 1, 'count', {
      action,
      userId,
      ...metadata
    });

    // Log de auditoria para ações importantes
    const auditableActions = ['register', 'login', 'paint_pixel', 'claim_bonus'];
    if (auditableActions.includes(action)) {
      await this.loggingService.logAudit(
        `Ação do usuário: ${action}`,
        userId,
        metadata
      );
    }
  }

  async recordSystemEvent(event, severity = 'info', metadata = {}) {
    await this.recordMetric('system_event', 1, 'count', {
      event,
      severity,
      ...metadata
    });

    await this.loggingService.logSystemEvent(`Evento do sistema: ${event}`, {
      severity,
      ...metadata
    });
  }

  async getMetricsOverview(timeframe = '24h') {
    const since = this.getTimeframeSince(timeframe);

    const [
      responseTimes,
      errorCounts,
      requestCounts,
      userActions,
      systemEvents
    ] = await Promise.all([
      this.monitoringRepository.getAggregatedMetrics('response_time', '1h', since),
      this.monitoringRepository.getAggregatedMetrics('error_count', '1h', since),
      this.monitoringRepository.getAggregatedMetrics('request_count', '1h', since),
      this.monitoringRepository.getAggregatedMetrics('user_action', '1h', since),
      this.monitoringRepository.getAggregatedMetrics('system_event', '1h', since)
    ]);

    const summary = this.calculateSummaryStats({
      responseTimes,
      errorCounts,
      requestCounts,
      userActions,
      systemEvents
    });

    return {
      timeframe,
      period: `últimas ${timeframe}`,
      summary,
      charts: {
        responseTimes,
        errorCounts,
        requestCounts,
        userActions,
        systemEvents
      }
    };
  }

  calculateSummaryStats(metrics) {
    const summary = {
      totalRequests: 0,
      totalErrors: 0,
      avgResponseTime: 0,
      maxResponseTime: 0,
      errorRate: 0,
      totalUserActions: 0,
      totalSystemEvents: 0
    };

    // Calcular totais e médias
    if (metrics.requestCounts.length > 0) {
      summary.totalRequests = metrics.requestCounts.reduce((sum, item) => sum + item.count, 0);
    }

    if (metrics.errorCounts.length > 0) {
      summary.totalErrors = metrics.errorCounts.reduce((sum, item) => sum + item.count, 0);
    }

    if (metrics.responseTimes.length > 0) {
      const avgValues = metrics.responseTimes.map(item => item.avg);
      summary.avgResponseTime = Math.round(avgValues.reduce((sum, val) => sum + val, 0) / avgValues.length);
      summary.maxResponseTime = Math.max(...metrics.responseTimes.map(item => item.max));
    }

    if (metrics.userActions.length > 0) {
      summary.totalUserActions = metrics.userActions.reduce((sum, item) => sum + item.count, 0);
    }

    if (metrics.systemEvents.length > 0) {
      summary.totalSystemEvents = metrics.systemEvents.reduce((sum, item) => sum + item.count, 0);
    }

    // Calcular taxa de erro
    if (summary.totalRequests > 0) {
      summary.errorRate = Math.round((summary.totalErrors / summary.totalRequests) * 100 * 100) / 100;
    }

    return summary;
  }

  getTimeframeSince(timeframe) {
    const now = new Date();
    switch (timeframe) {
      case '1h':
        return new Date(now.getTime() - 60 * 60 * 1000);
      case '6h':
        return new Date(now.getTime() - 6 * 60 * 60 * 1000);
      case '24h':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }
  }

  async getHealthStatus() {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    try {
      const [recentErrors, recentRequests, avgResponseTime] = await Promise.all([
        this.monitoringRepository.getMetrics('error_count', oneHourAgo),
        this.monitoringRepository.getMetrics('request_count', oneHourAgo),
        this.monitoringRepository.getAggregatedMetrics('response_time', '1h', oneHourAgo)
      ]);

      const errorCount = recentErrors.reduce((sum, metric) => sum + metric.value, 0);
      const requestCount = recentRequests.reduce((sum, metric) => sum + metric.value, 0);
      const errorRate = requestCount > 0 ? (errorCount / requestCount) * 100 : 0;
      
      const currentAvgResponseTime = avgResponseTime.length > 0 ? 
        avgResponseTime[avgResponseTime.length - 1].avg : 0;

      let status = 'healthy';
      let issues = [];

      if (errorRate > 5) {
        status = 'degraded';
        issues.push(`Taxa de erro alta: ${errorRate.toFixed(2)}%`);
      }

      if (currentAvgResponseTime > 2000) {
        status = errorRate > 10 ? 'critical' : 'degraded';
        issues.push(`Tempo de resposta alto: ${currentAvgResponseTime}ms`);
      }

      if (requestCount === 0) {
        status = 'warning';
        issues.push('Nenhuma requisição na última hora');
      }

      return {
        status,
        timestamp: now.toISOString(),
        metrics: {
          errorRate: Math.round(errorRate * 100) / 100,
          avgResponseTime: Math.round(currentAvgResponseTime),
          requestCount,
          errorCount
        },
        issues,
        uptime: process.uptime()
      };
    } catch (error) {
      return {
        status: 'critical',
        timestamp: now.toISOString(),
        error: 'Falha ao verificar status de saúde',
        uptime: process.uptime()
      };
    }
  }

  async cleanupOldMetrics(daysToKeep = 7) {
    try {
      const deletedCount = await this.monitoringRepository.deleteOldMetrics(daysToKeep);
      
      await this.recordSystemEvent('metrics_cleanup', 'info', {
        deletedMetrics: deletedCount,
        daysToKeep
      });

      return { success: true, deletedCount };
    } catch (error) {
      console.error('Erro na limpeza de métricas:', error);
      return { success: false, error: error.message };
    }
  }

  async shutdown() {
    console.log('🔄 Fazendo flush final das métricas...');
    await this.flushMetricsBuffer();
    console.log('✅ MonitoringService finalizado');
  }
}

module.exports = MonitoringService;