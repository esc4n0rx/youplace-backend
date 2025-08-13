class CoordinateSystem {
    constructor() {
      // Sistema baseado em coordenadas geográficas do OpenStreetMap
      // Longitude: -180 a +180 (Oeste para Leste)
      // Latitude: -85.0511 a +85.0511 (Sul para Norte) - Limite do Web Mercator
      
      this.config = {
        // Limites geográficos reais do mundo
        minLongitude: -180,
        maxLongitude: 180,
        minLatitude: -85.0511,
        maxLatitude: 85.0511,
        
        // Precisão dos pixels (quantas casas decimais)
        // 4 casas decimais = ~11 metros de precisão
        precision: 4,
        
        // Multiplicador para converter coordenadas geográficas em pixels
        // Permite coordenadas mais granulares
        pixelMultiplier: 10000, // 4 casas decimais * 10000
      };
    }
  
    // Converter coordenadas geográficas (lat, lng) para coordenadas de pixel (x, y)
    geoToPixel(latitude, longitude) {
      // Validar entrada
      if (!this.isValidGeoCoordinate(latitude, longitude)) {
        throw new Error(`Coordenadas geográficas inválidas: lat=${latitude}, lng=${longitude}`);
      }
  
      // Converter para coordenadas de pixel
      // X = longitude * multiplicador (Oeste-Leste)
      // Y = latitude * multiplicador (Sul-Norte), invertido para sistema de tela
      const x = Math.round(longitude * this.config.pixelMultiplier);
      const y = Math.round(-latitude * this.config.pixelMultiplier); // Negativo para inverter Y
  
      return { x, y };
    }
  
    // Converter coordenadas de pixel (x, y) para coordenadas geográficas (lat, lng)
    pixelToGeo(x, y) {
      // Validar entrada
      if (!this.isValidPixelCoordinate(x, y)) {
        throw new Error(`Coordenadas de pixel inválidas: x=${x}, y=${y}`);
      }
  
      // Converter para coordenadas geográficas
      const longitude = x / this.config.pixelMultiplier;
      const latitude = -y / this.config.pixelMultiplier; // Negativo para inverter Y
  
      return { latitude, longitude };
    }
  
    // Validar coordenadas geográficas
    isValidGeoCoordinate(latitude, longitude) {
      return (
        typeof latitude === 'number' &&
        typeof longitude === 'number' &&
        latitude >= this.config.minLatitude &&
        latitude <= this.config.maxLatitude &&
        longitude >= this.config.minLongitude &&
        longitude <= this.config.maxLongitude
      );
    }
  
    // Validar coordenadas de pixel
    isValidPixelCoordinate(x, y) {
      if (!Number.isInteger(x) || !Number.isInteger(y)) {
        return false;
      }
  
      // Calcular limites em pixels
      const minX = Math.round(this.config.minLongitude * this.config.pixelMultiplier);
      const maxX = Math.round(this.config.maxLongitude * this.config.pixelMultiplier);
      const minY = Math.round(-this.config.maxLatitude * this.config.pixelMultiplier);
      const maxY = Math.round(-this.config.minLatitude * this.config.pixelMultiplier);
  
      return x >= minX && x <= maxX && y >= minY && y <= maxY;
    }
  
    // Obter limites em coordenadas de pixel
    getPixelBounds() {
      const minX = Math.round(this.config.minLongitude * this.config.pixelMultiplier);
      const maxX = Math.round(this.config.maxLongitude * this.config.pixelMultiplier);
      const minY = Math.round(-this.config.maxLatitude * this.config.pixelMultiplier);
      const maxY = Math.round(-this.config.minLatitude * this.config.pixelMultiplier);
  
      return { minX, maxX, minY, maxY };
    }
  
    // Obter limites geográficos
    getGeoBounds() {
      return {
        minLatitude: this.config.minLatitude,
        maxLatitude: this.config.maxLatitude,
        minLongitude: this.config.minLongitude,
        maxLongitude: this.config.maxLongitude
      };
    }
  
    // Calcular área de uma bounding box em km²
    calculateAreaKm2(minLat, maxLat, minLng, maxLng) {
      const earthRadius = 6371; // km
      
      const latDiff = (maxLat - minLat) * Math.PI / 180;
      const lngDiff = (maxLng - minLng) * Math.PI / 180;
      const avgLat = (minLat + maxLat) / 2 * Math.PI / 180;
      
      const area = earthRadius * earthRadius * latDiff * lngDiff * Math.cos(avgLat);
      return Math.abs(area);
    }
  
    // Validar se uma área de busca não é muito grande (para performance)
    isValidSearchArea(minX, maxX, minY, maxY, maxAreaKm2 = 10000) {
      // Converter para coordenadas geográficas
      const { latitude: minLat, longitude: minLng } = this.pixelToGeo(minX, minY);
      const { latitude: maxLat, longitude: maxLng } = this.pixelToGeo(maxX, maxY);
      
      // Calcular área
      const areaKm2 = this.calculateAreaKm2(minLat, maxLat, minLng, maxLng);
      
      return areaKm2 <= maxAreaKm2;
    }
  
    // Gerar coordenadas de exemplo para diferentes regiões
    getExampleCoordinates() {
      return {
        brasil: {
          center: { latitude: -14.2350, longitude: -51.9253 },
          pixel: this.geoToPixel(-14.2350, -51.9253)
        },
        eua: {
          center: { latitude: 39.8283, longitude: -98.5795 },
          pixel: this.geoToPixel(39.8283, -98.5795)
        },
        europa: {
          center: { latitude: 54.5260, longitude: 15.2551 },
          pixel: this.geoToPixel(54.5260, 15.2551)
        },
        africa: {
          center: { latitude: -8.7832, longitude: 34.5085 },
          pixel: this.geoToPixel(-8.7832, 34.5085)
        },
        asia: {
          center: { latitude: 29.8405, longitude: 89.2961 },
          pixel: this.geoToPixel(29.8405, 89.2961)
        }
      };
    }
  }
  
  module.exports = CoordinateSystem;