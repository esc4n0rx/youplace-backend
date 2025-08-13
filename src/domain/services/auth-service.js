const bcrypt = require('bcrypt');
const admin = require('../../config/firebase');
const UserRepository = require('../../data/repositories/user-repository');
const { generateToken } = require('../../shared/utils/jwt-utils');
const { generateUniqueUsername } = require('../../shared/utils/username-generator');

class AuthService {
  constructor() {
    this.userRepository = new UserRepository();
  }

  async register(username, password, ip) {
    // Verificar se o usuário já existe
    const existingUser = await this.userRepository.findByUsername(username);
    if (existingUser) {
      throw new Error('Nome de usuário já está em uso');
    }

    // Verificar se o IP já foi usado (anti-abuse)
    const existingIpUsers = await this.userRepository.findByRegistrationIp(ip);
    if (existingIpUsers.length > 0) {
      throw new Error('Este IP já foi usado para criar uma conta');
    }

    // Hash da senha
    const saltRounds = 12;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Criar usuário
    const userData = {
      username,
      password_hash: hashedPassword,
      email: null,
      firebase_uid: null,
      credits: 1000,
      registration_ip: ip,
      is_google_user: false
    };

    const user = await this.userRepository.create(userData);
    const token = generateToken({ userId: user.id, username: user.username });

    return {
      user: user.toJSON(),
      token
    };
  }

  async login(username, password) {
    // Buscar usuário
    const user = await this.userRepository.findByUsername(username);
    if (!user) {
      throw new Error('Credenciais inválidas');
    }

    // Verificar se é usuário do Google (não tem senha local)
    if (user.isGoogleUser) {
      throw new Error('Esta conta foi criada com Google. Use o login do Google.');
    }

    // Verificar se o usuário tem senha armazenada
    if (!user.password_hash) {
      throw new Error('Usuário não possui senha configurada. Entre em contato com o suporte.');
    }

    // Verificar se a senha fornecida é válida
    if (!password || typeof password !== 'string') {
      throw new Error('Credenciais inválidas');
    }

    try {
      // Verificar senha
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        throw new Error('Credenciais inválidas');
      }
    } catch (bcryptError) {
      console.error('Erro no bcrypt.compare:', bcryptError);
      throw new Error('Erro ao verificar credenciais');
    }

    const token = generateToken({ userId: user.id, username: user.username });

    return {
      user: user.toJSON(),
      token
    };
  }

  async googleAuth(idToken, ip) {
    try {
      // Verificar token do Google com Firebase
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const { uid, email, name } = decodedToken;

      if (!email) {
        throw new Error('Email não fornecido pelo Google');
      }

      // Verificar se usuário já existe pelo Firebase UID
      let user = await this.userRepository.findByFirebaseUid(uid);
      
      if (user) {
        // Usuário já existe, fazer login
        const token = generateToken({ userId: user.id, username: user.username });
        return {
          user: user.toJSON(),
          token
        };
      }

      // Verificar se já existe usuário com o mesmo email
      const existingEmailUser = await this.userRepository.findByEmail(email);
      if (existingEmailUser) {
        throw new Error('Já existe uma conta com este email. Use o login tradicional ou vincule sua conta Google.');
      }

      // Verificar emails similares (anti-abuse)
      const similarEmails = await this.userRepository.findSimilarEmails(email);
      if (similarEmails.length > 0) {
        throw new Error('Detectada possível conta duplicada');
      }

      // Verificar se o IP já foi usado (anti-abuse)
      const existingIpUsers = await this.userRepository.findByRegistrationIp(ip);
      if (existingIpUsers.length > 0) {
        throw new Error('Este IP já foi usado para criar uma conta');
      }

      // Gerar username único
      const username = await generateUniqueUsername(
        async (username) => await this.userRepository.usernameExists(username)
      );

      // Criar novo usuário
      const userData = {
        username,
        password_hash: null, // Usuários do Google não têm senha local
        email,
        firebase_uid: uid,
        credits: 1000,
        registration_ip: ip,
        is_google_user: true
      };

      user = await this.userRepository.create(userData);
      const token = generateToken({ userId: user.id, username: user.username });

      return {
        user: user.toJSON(),
        token
      };

    } catch (error) {
      if (error.code === 'auth/id-token-expired') {
        throw new Error('Token do Google expirado');
      } else if (error.code === 'auth/id-token-revoked') {
        throw new Error('Token do Google revogado');
      } else if (error.code === 'auth/invalid-id-token') {
        throw new Error('Token do Google inválido');
      }
      
      throw error;
    }
  }
}

module.exports = AuthService;