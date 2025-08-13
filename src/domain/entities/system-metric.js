class SystemMetric {
    constructor(data) {
      this.id = data.id;
      this.metricType = data.metric_type; // 'response_time', 'request_count', 'error_rate', etc.
      this.value = data.value;
      this.unit = data.unit; // 'ms', 'count', 'percentage', 'bytes'
      this.endpoint = data.endpoint || null;
      this.method = data.method || null;
      this.statusCode = data.status_code || null;
      this.metadata = data.metadata || {};
      this.timestamp = data.timestamp;
      this.createdAt = data.created_at;
    }
  
    toJSON() {
      return {
        id: this.id,
        metricType: this.metricType,
        value: this.value,
        unit: this.unit,
        endpoint: this.endpoint,
        method: this.method,
        statusCode: this.statusCode,
        metadata: this.metadata,
        timestamp: this.timestamp,
        createdAt: this.createdAt
      };
    }
  
    isResponseTime() {
      return this.metricType === 'response_time';
    }
  
    isErrorMetric() {
      return this.metricType === 'error_rate' || this.statusCode >= 400;
    }
  
    isSlowResponse() {
      return this.isResponseTime() && this.value > 1000;
    }
  
    getFormattedValue() {
      switch (this.unit) {
        case 'ms':
          return `${this.value}ms`;
        case 'percentage':
          return `${this.value}%`;
        case 'bytes':
          return this.formatBytes(this.value);
        default:
          return this.value.toString();
      }
    }
  
    formatBytes(bytes) {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
  }
  
  module.exports = SystemMetric;