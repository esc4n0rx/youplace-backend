class MetricsCalculator {
    static calculatePercentiles(values, percentiles = [50, 90, 95, 99]) {
      if (!values || values.length === 0) return {};
      
      const sorted = [...values].sort((a, b) => a - b);
      const result = {};
      
      percentiles.forEach(p => {
        const index = Math.ceil((p / 100) * sorted.length) - 1;
        result[`p${p}`] = sorted[Math.max(0, index)];
      });
      
      return result;
    }
  
    static calculateStats(values) {
      if (!values || values.length === 0) {
        return {
          count: 0,
          sum: 0,
          avg: 0,
          min: 0,
          max: 0,
          median: 0,
          std: 0
        };
      }
  
      const count = values.length;
      const sum = values.reduce((acc, val) => acc + val, 0);
      const avg = sum / count;
      const sorted = [...values].sort((a, b) => a - b);
      const median = count % 2 === 0 
        ? (sorted[count / 2 - 1] + sorted[count / 2]) / 2
        : sorted[Math.floor(count / 2)];
  
      // Desvio padrão
      const variance = values.reduce((acc, val) => acc + Math.pow(val - avg, 2), 0) / count;
      const std = Math.sqrt(variance);
  
      return {
        count,
        sum,
        avg: Math.round(avg * 100) / 100,
        min: Math.min(...values),
        max: Math.max(...values),
        median: Math.round(median * 100) / 100,
        std: Math.round(std * 100) / 100,
        ...this.calculatePercentiles(values)
      };
    }
  
    static calculateTrend(values, windowSize = 5) {
      if (!values || values.length < windowSize * 2) {
        return { trend: 'stable', confidence: 0 };
      }
  
      // Calcular médias de janelas deslizantes
      const recentWindow = values.slice(-windowSize);
      const previousWindow = values.slice(-windowSize * 2, -windowSize);
  
      const recentAvg = recentWindow.reduce((sum, val) => sum + val, 0) / windowSize;
      const previousAvg = previousWindow.reduce((sum, val) => sum + val, 0) / windowSize;
  
      const change = ((recentAvg - previousAvg) / previousAvg) * 100;
      const absChange = Math.abs(change);
  
      let trend = 'stable';
      let confidence = 0;
  
      if (absChange > 20) {
        trend = change > 0 ? 'increasing' : 'decreasing';
        confidence = Math.min(100, absChange);
      } else if (absChange > 10) {
        trend = change > 0 ? 'slightly_increasing' : 'slightly_decreasing';
        confidence = absChange;
      }
  
      return {
        trend,
        confidence: Math.round(confidence),
        change: Math.round(change * 100) / 100,
        recentAvg: Math.round(recentAvg * 100) / 100,
        previousAvg: Math.round(previousAvg * 100) / 100
      };
    }
  
    static calculateErrorRate(totalRequests, errorRequests) {
      if (totalRequests === 0) return 0;
      return Math.round((errorRequests / totalRequests) * 100 * 100) / 100;
    }
  
    static calculateThroughput(requests, timeWindowMinutes) {
      if (timeWindowMinutes === 0) return 0;
      return Math.round((requests / timeWindowMinutes) * 100) / 100;
    }
  
    static calculateAvailability(totalTime, downtime) {
      if (totalTime === 0) return 100;
      const uptime = totalTime - downtime;
      return Math.round((uptime / totalTime) * 100 * 100) / 100;
    }
  
    static groupByTimeInterval(data, intervalMinutes = 60) {
      const groups = new Map();
      
      data.forEach(item => {
        const timestamp = new Date(item.timestamp || item.createdAt);
        const intervalStart = new Date(
          timestamp.getFullYear(),
          timestamp.getMonth(),
          timestamp.getDate(),
          Math.floor(timestamp.getHours() * 60 / intervalMinutes) * intervalMinutes / 60
        );
        
        const key = intervalStart.toISOString();
        
        if (!groups.has(key)) {
          groups.set(key, {
            timestamp: key,
            items: []
          });
        }
        
        groups.get(key).items.push(item);
      });
      
      return Array.from(groups.values()).sort((a, b) => 
        new Date(a.timestamp) - new Date(b.timestamp)
      );
    }
  
    static calculateApdex(responseTimes, threshold = 500, tolerance = 2000) {
      if (!responseTimes || responseTimes.length === 0) return 0;
  
      let satisfied = 0;
      let tolerating = 0;
      let frustrated = 0;
  
      responseTimes.forEach(rt => {
        if (rt <= threshold) {
          satisfied++;
        } else if (rt <= tolerance) {
          tolerating++;
        } else {
          frustrated++;
        }
      });
  
      const total = responseTimes.length;
      const apdex = (satisfied + (tolerating / 2)) / total;
      
      return Math.round(apdex * 100) / 100;
    }
  
    static detectAnomalies(values, threshold = 2) {
      if (!values || values.length < 10) return [];
  
      const stats = this.calculateStats(values);
      const anomalies = [];
  
      values.forEach((value, index) => {
        const zScore = Math.abs((value - stats.avg) / stats.std);
        if (zScore > threshold) {
          anomalies.push({
            index,
            value,
            zScore: Math.round(zScore * 100) / 100,
            severity: zScore > 3 ? 'high' : 'medium'
          });
        }
      });
  
      return anomalies;
    }
  
    static formatDuration(milliseconds) {
      if (milliseconds < 1000) {
        return `${Math.round(milliseconds)}ms`;
      } else if (milliseconds < 60000) {
        return `${Math.round(milliseconds / 1000 * 10) / 10}s`;
      } else if (milliseconds < 3600000) {
        return `${Math.round(milliseconds / 60000)}min`;
      } else {
        return `${Math.round(milliseconds / 3600000 * 10) / 10}h`;
      }
    }
  
    static formatBytes(bytes) {
      if (bytes === 0) return '0 B';
      
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      
      return `${Math.round(bytes / Math.pow(k, i) * 100) / 100} ${sizes[i]}`;
    }
  
    static formatRate(value, unit = 'req/min') {
      if (value < 1) {
        return `${Math.round(value * 100) / 100} ${unit}`;
      } else if (value < 1000) {
        return `${Math.round(value)} ${unit}`;
      } else if (value < 1000000) {
        return `${Math.round(value / 1000 * 10) / 10}K ${unit}`;
      } else {
        return `${Math.round(value / 1000000 * 10) / 10}M ${unit}`;
      }
    }
  }
  
  module.exports = MetricsCalculator;