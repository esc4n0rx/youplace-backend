const http = require('http');
const app = require('./src/app');
const SocketServer = require('./src/websocket/socket-server');
const RealtimeService = require('./src/domain/services/realtime-service');
const { port } = require('./src/config/environment');
const logger = require('./src/config/logger');

// Criar servidor HTTP
const httpServer = http.createServer(app);

// Inicializar WebSocket Server
const socketServer = new SocketServer(httpServer);

// Inicializar Realtime Service
const realtimeService = new RealtimeService();
realtimeService.setSocketServer(socketServer);

// Disponibilizar realtimeService globalmente para o app
app.locals.realtimeService = realtimeService;

// Iniciar servidor
httpServer.listen(port, () => {
  console.log(`🚀 YouPlace Backend Server running on port ${port}`);
  console.log(`📍 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 API Base URL: http://localhost:${port}/api/v1`);
  console.log(`🔌 WebSocket Server: ws://localhost:${port}`);
  console.log(`📡 Redis: ${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`);
});

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`\n📤 Received ${signal}, starting graceful shutdown...`);
  
  try {
    // Fechar servidor HTTP
    httpServer.close(async () => {
      console.log('🔌 HTTP server closed');
      
      // Shutdown WebSocket server
      await socketServer.shutdown();
      
      // Cleanup realtime service
      await realtimeService.cleanup();
      
      console.log('✅ Graceful shutdown completed');
      process.exit(0);
    });
    
    // Timeout para shutdown forçado
    setTimeout(() => {
      console.error('❌ Shutdown timeout, forcing exit');
      process.exit(1);
    }, 10000);
    
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Capturar erros não tratados
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});