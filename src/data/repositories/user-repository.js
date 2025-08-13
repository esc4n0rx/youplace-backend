const { supabaseAdmin } = require('../../config/database');
const User = require('../../domain/entities/user');

class UserRepository {
  async findByUsername(username) {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('username', username)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw new Error(`Erro ao buscar usuário: ${error.message}`);
    }

    return data ? new User(data) : null;
  }

  async findByEmail(email) {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Erro ao buscar usuário por email: ${error.message}`);
    }

    return data ? new User(data) : null;
  }

  async findByFirebaseUid(firebaseUid) {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('firebase_uid', firebaseUid)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Erro ao buscar usuário por Firebase UID: ${error.message}`);
    }

    return data ? new User(data) : null;
  }

  async findByRegistrationIp(ip) {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .eq('registration_ip', ip);

    if (error) {
      throw new Error(`Erro ao buscar usuários por IP: ${error.message}`);
    }

    return data.map(user => new User(user));
  }

  async findSimilarEmails(email) {
    // Remove pontos e busca emails similares (ex: user.name@gmail.com vs username@gmail.com)
    const emailWithoutDots = email.replace(/\./g, '');
    const [localPart, domain] = email.split('@');
    const localPartWithoutDots = localPart.replace(/\./g, '');

    const { data, error } = await supabaseAdmin
      .from('users')
      .select('*')
      .or(`email.eq.${email},email.eq.${localPartWithoutDots}@${domain}`);

    if (error) {
      throw new Error(`Erro ao buscar emails similares: ${error.message}`);
    }

    return data.map(user => new User(user));
  }

  async create(userData) {
    const { data, error } = await supabaseAdmin
      .from('users')
      .insert(userData)
      .select()
      .single();

    if (error) {
      throw new Error(`Erro ao criar usuário: ${error.message}`);
    }

    return new User(data);
  }

  async usernameExists(username) {
    const user = await this.findByUsername(username);
    return user !== null;
  }

  async emailExists(email) {
    const user = await this.findByEmail(email);
    return user !== null;
  }
}

module.exports = UserRepository;