class User {
    constructor(data) {
      this.id = data.id;
      this.username = data.username;
      this.password_hash = data.password_hash; // Importante: manter o nome original do banco
      this.email = data.email;
      this.firebaseUid = data.firebase_uid || null;
      this.credits = data.credits || 1000;
      this.registrationIp = data.registration_ip;
      this.isGoogleUser = data.is_google_user || false;
      this.createdAt = data.created_at;
      this.updatedAt = data.updated_at;
    }
  
    toJSON() {
      return {
        id: this.id,
        username: this.username,
        email: this.email,
        credits: this.credits,
        isGoogleUser: this.isGoogleUser,
        createdAt: this.createdAt,
        updatedAt: this.updatedAt
        // Não incluir password_hash no JSON de resposta por segurança
      };
    }
  }
  
  module.exports = User;