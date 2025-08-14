class AdminAction {
    constructor(data) {
      this.id = data.id;
      this.adminId = data.admin_id;
      this.targetUserId = data.target_user_id;
      this.action = data.action; // 'ban', 'suspend', 'unban', 'add_credits', 'remove_credits'
      this.reason = data.reason;
      this.metadata = data.metadata || {};
      this.createdAt = data.created_at;
    }
  
    toJSON() {
      return {
        id: this.id,
        adminId: this.adminId,
        targetUserId: this.targetUserId,
        action: this.action,
        reason: this.reason,
        metadata: this.metadata,
        createdAt: this.createdAt
      };
    }
  }
  
  module.exports = AdminAction;