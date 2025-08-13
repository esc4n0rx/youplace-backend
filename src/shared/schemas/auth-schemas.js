const { z } = require('zod');

const registerSchema = z.object({
  username: z.string()
    .min(3, 'Nome de usuário deve ter pelo menos 3 caracteres')
    .max(30, 'Nome de usuário deve ter no máximo 30 caracteres')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Nome de usuário deve conter apenas letras, números, _ e -'),
  password: z.string()
    .min(6, 'Senha deve ter pelo menos 6 caracteres')
    .max(128, 'Senha deve ter no máximo 128 caracteres')
});

const loginSchema = z.object({
  username: z.string().min(1, 'Nome de usuário é obrigatório'),
  password: z.string().min(1, 'Senha é obrigatória')
});

const googleAuthSchema = z.object({
  idToken: z.string().min(1, 'Token do Google é obrigatório')
});

module.exports = {
  registerSchema,
  loginSchema,
  googleAuthSchema
};