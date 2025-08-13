const express = require('express');
const AuthController = require('../controllers/auth-controller');
const { validateRequest } = require('../middlewares/validation-middleware');
const { authenticateToken } = require('../middlewares/auth-middleware');
const { registerSchema, loginSchema, googleAuthSchema } = require('../../shared/schemas/auth-schemas');

const router = express.Router();
const authController = new AuthController();

// Rota de registro
router.post('/register', 
  validateRequest(registerSchema), 
  authController.register
);

// Rota de login
router.post('/login', 
  validateRequest(loginSchema), 
  authController.login
);

// Rota de login com Google
router.post('/google', 
  validateRequest(googleAuthSchema), 
  authController.googleAuth
);

// Rota para obter dados do usuário autenticado
router.get('/me', 
  authenticateToken, 
  authController.me
);

module.exports = router;