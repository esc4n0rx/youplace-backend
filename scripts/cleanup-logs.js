const LoggingService = require('../src/domain/services/logging-service');
const MonitoringService = require('../src/domain/services/monitoring-service');

async function cleanup() {
  console.log('🧹 Iniciando limpeza de logs e métricas...');
  
  const loggingService = new LoggingService();
  const monitoringService = new MonitoringService();
  
  try {
    const [logCleanup, metricCleanup] = await Promise.all([
      loggingService.cleanupOldLogs(30), // 30 dias
      monitoringService.cleanupOldMetrics(7) // 7 dias
    ]);
    
    console.log(`✅ Limpeza concluída:`);
    console.log(`   📝 Logs removidos: ${logCleanup.deletedCount}`);
    console.log(`   📊 Métricas removidas: ${metricCleanup.deletedCount}`);
  } catch (error) {
    console.error('❌ Erro na limpeza:', error);
  }
  
  process.exit(0);
}

cleanup();