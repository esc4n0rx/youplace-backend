class CreditTransaction {
    constructor(data) {
      this.id = data.id;
      this.userId = data.user_id;
      this.amount = data.amount;
      this.type = data.type; // 'daily_bonus', 'pixel_paint', 'admin_adjustment'
      this.description = data.description;
      this.createdAt = data.created_at;
    }
  
    toJSON() {
      return {
        id: this.id,
        userId: this.userId,
        amount: this.amount,
        type: this.type,
        description: this.description,
        createdAt: this.createdAt
      };
    }
  }
  
  module.exports = CreditTransaction;