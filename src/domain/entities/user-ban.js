class UserBan {
    constructor(data) {
      this.id = data.id;
      this.userId = data.user_id;
      this.adminId = data.admin_id;
      this.reason = data.reason;
      this.type = data.type;
      this.isActive = data.is_active;
      this.expiresAt = data.expires_at; 
      this.createdAt = data.created_at;
      this.updatedAt = data.updated_at;
    }
  
    toJSON() {
      return {
        id: this.id,
        userId: this.userId,
        adminId: this.adminId,
        reason: this.reason,
        type: this.type,
        isActive: this.isActive,
        expiresAt: this.expiresAt,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt
      };
    }
  
    isExpired() {
      if (!this.expiresAt) return false;
      return new Date() > new Date(this.expiresAt);
    }
  
    isPermanent() {
      return this.expiresAt === null;
    }
  }
  
  module.exports = UserBan;