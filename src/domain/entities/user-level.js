class UserLevel {
    constructor(data) {
      this.id = data.id;
      this.userId = data.user_id;
      this.currentLevel = data.current_level || 1;
      this.totalPixelsPainted = data.total_pixels_painted || 0;
      this.pixelsForCurrentLevel = data.pixels_for_current_level || 0;
      this.pixelsForNextLevel = data.pixels_for_next_level || 10;
      this.title = data.title || 'Explorador Iniciante';
      this.experiencePoints = data.experience_points || 0;
      this.lastLevelUp = data.last_level_up;
      this.createdAt = data.created_at;
      this.updatedAt = data.updated_at;
    }
  
    toJSON() {
      return {
        id: this.id,
        userId: this.userId,
        currentLevel: this.currentLevel,
        totalPixelsPainted: this.totalPixelsPainted,
        pixelsForCurrentLevel: this.pixelsForCurrentLevel,
        pixelsForNextLevel: this.pixelsForNextLevel,
        title: this.title,
        experiencePoints: this.experiencePoints,
        lastLevelUp: this.lastLevelUp,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt,
        // Campos calculados para frontend
        progressPercentage: this.getProgressPercentage(),
        pixelsUntilNextLevel: this.getPixelsUntilNextLevel()
      };
    }
  
    getProgressPercentage() {
      if (this.pixelsForNextLevel === 0) return 100;
      return Math.round((this.pixelsForCurrentLevel / this.pixelsForNextLevel) * 100);
    }
  
    getPixelsUntilNextLevel() {
      return Math.max(0, this.pixelsForNextLevel - this.pixelsForCurrentLevel);
    }
  }
  
  module.exports = UserLevel;