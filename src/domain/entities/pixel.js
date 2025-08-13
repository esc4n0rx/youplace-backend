class Pixel {
    constructor(data) {
      this.id = data.id;
      this.x = data.x;
      this.y = data.y;
      this.color = data.color;
      this.userId = data.user_id;
      this.username = data.username; // Para facilitar consultas
      this.createdAt = data.created_at;
    }
  
    toJSON() {
      return {
        id: this.id,
        x: this.x,
        y: this.y,
        color: this.color,
        userId: this.userId,
        username: this.username,
        createdAt: this.createdAt
      };
    }
  }
  
  module.exports = Pixel;