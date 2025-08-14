const logger = require('../config/logger');

class BatchManager {
  constructor(redisService) {
    this.redisService = redisService;
    this.batches = new Map(); // roomId -> { pixels: [], timeout: Timer }
    this.BATCH_TIMEOUT = 500; // ms
    this.MAX_BATCH_SIZE = 50;
    this.callbacks = new Set();
  }

  addPixel(roomId, pixel) {
    if (!this.batches.has(roomId)) {
      this.batches.set(roomId, {
        pixels: [],
        timeout: null
      });
    }

    const batch = this.batches.get(roomId);
    batch.pixels.push(pixel);

    // Se atingiu o tamanho máximo, flush imediatamente
    if (batch.pixels.length >= this.MAX_BATCH_SIZE) {
      this.flushBatch(roomId);
    } else if (!batch.timeout) {
      // Agendar flush automático
      batch.timeout = setTimeout(() => {
        this.flushBatch(roomId);
      }, this.BATCH_TIMEOUT);
    }
  }

  flushBatch(roomId) {
    const batch = this.batches.get(roomId);
    if (!batch || batch.pixels.length === 0) {
      return;
    }

    // Limpar timeout se existe
    if (batch.timeout) {
      clearTimeout(batch.timeout);
      batch.timeout = null;
    }

    // Preparar batch para envio
    const batchData = {
      type: 'pixels_batch',
      roomId,
      pixels: [...batch.pixels],
      timestamp: Date.now(),
      count: batch.pixels.length
    };

    // Limpar batch
    batch.pixels = [];

    // Enviar para todos os callbacks registrados
    for (const callback of this.callbacks) {
      try {
        callback(batchData);
      } catch (error) {
        logger.error('Batch callback error:', error);
      }
    }

    // Log para monitoramento
    logger.debug('Batch flushed', {
      roomId,
      pixelCount: batchData.count,
      timestamp: batchData.timestamp
    });

    // Armazenar no Redis para histórico
    this.storeBatchInRedis(batchData);
  }

  async storeBatchInRedis(batchData) {
    try {
      // Adicionar cada pixel ao histórico do room
      for (const pixel of batchData.pixels) {
        await this.redisService.addPixelToRoom(batchData.roomId, {
          ...pixel,
          timestamp: batchData.timestamp
        });
      }
    } catch (error) {
      logger.error('Error storing batch in Redis:', error);
    }
  }

  onBatchReady(callback) {
    this.callbacks.add(callback);
  }

  removeBatchCallback(callback) {
    this.callbacks.delete(callback);
  }

  flushAllBatches() {
    for (const roomId of this.batches.keys()) {
      this.flushBatch(roomId);
    }
  }

  getBatchStats() {
    const stats = {
      totalRooms: this.batches.size,
      pendingPixels: 0,
      callbacks: this.callbacks.size
    };

    for (const batch of this.batches.values()) {
      stats.pendingPixels += batch.pixels.length;
    }

    return stats;
  }

  cleanup() {
    // Flush todos os batches pendentes
    this.flushAllBatches();

    // Limpar timeouts
    for (const batch of this.batches.values()) {
      if (batch.timeout) {
        clearTimeout(batch.timeout);
      }
    }

    // Limpar mapas
    this.batches.clear();
    this.callbacks.clear();

    logger.info('BatchManager cleanup completed');
  }
}

module.exports = BatchManager;