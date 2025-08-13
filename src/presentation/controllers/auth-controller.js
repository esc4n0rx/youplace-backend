const AuthService = require('../../domain/services/auth-service');

class AuthController {
  constructor() {
    this.authService = new AuthService();
  }

  register = async (req, res, next) => {
    try {
      const { username, password } = req.body;
      const ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;

      const result = await this.authService.register(username, password, ip);

      res.status(201).json({
        success: true,
        message: 'Usuário criado com sucesso',
        data: result
      });
    } catch (error) {
      next(error);
    }
  };

  login = async (req, res, next) => {
    try {
      const { username, password } = req.body;

      const result = await this.authService.login(username, password);

      res.status(200).json({
        success: true,
        message: 'Login realizado com sucesso',
        data: result
      });
    } catch (error) {
      next(error);
    }
  };

  googleAuth = async (req, res, next) => {
    try {
      const { idToken } = req.body;
      const ip = req.ip || req.connection.remoteAddress || req.socket.remoteAddress;

      const result = await this.authService.googleAuth(idToken, ip);

      res.status(200).json({
        success: true,
        message: result.user.id ? 'Login com Google realizado com sucesso' : 'Conta criada com Google com sucesso',
        data: result
      });
    } catch (error) {
      next(error);
    }
  };

  me = async (req, res, next) => {
    try {
      // req.user vem do middleware de autenticação
      res.status(200).json({
        success: true,
        data: {
          userId: req.user.userId,
          username: req.user.username
        }
      });
    } catch (error) {
      next(error);
    }
  };
}

module.exports = AuthController;