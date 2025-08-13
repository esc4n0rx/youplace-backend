class LogEntry {
    constructor(data) {
      this.id = data.id;
      this.level = data.level; // 'info', 'warn', 'error', 'debug'
      this.message = data.message;
      this.type = data.type; // 'audit', 'security', 'performance', 'system', etc.
      this.userId = data.user_id || null;
      this.ip = data.ip || null;
      this.userAgent = data.user_agent || null;
      this.endpoint = data.endpoint || null;
      this.method = data.method || null;
      this.statusCode = data.status_code || null;
      this.responseTime = data.response_time || null;
      this.metadata = data.metadata || {};
      this.createdAt = data.created_at;
    }
  
    toJSON() {
      return {
        id: this.id,
        level: this.level,
        message: this.message,
        type: this.type,
        userId: this.userId,
        ip: this.ip,
        userAgent: this.userAgent,
        endpoint: this.endpoint,
        method: this.method,
        statusCode: this.statusCode,
        responseTime: this.responseTime,
        metadata: this.metadata,
        createdAt: this.createdAt
      };
    }
  
    isError() {
      return this.level === 'error';
    }
  
    isWarning() {
      return this.level === 'warn';
    }
  
    isAudit() {
      return this.type === 'audit';
    }
  
    isSecurity() {
      return this.type === 'security';
    }
  
    isPerformance() {
      return this.type === 'performance';
    }
  
    isSlowRequest() {
      return this.responseTime && this.responseTime > 1000; // > 1s
    }
  }
  
  module.exports = LogEntry;