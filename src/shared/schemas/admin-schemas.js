const { z } = require('zod');

const banUserSchema = z.object({
  reason: z.string()
    .min(10, 'Motivo deve ter pelo menos 10 caracteres')
    .max(500, 'Motivo deve ter no máximo 500 caracteres'),
  type: z.enum(['ban', 'suspend']).optional(),
  duration: z.number()
    .int('Duração deve ser um número inteiro')
    .min(1, 'Duração mínima: 1 hora')
    .max(8760, 'Duração máxima: 1 ano (8760 horas)')
    .optional()
});

const adminActionSchema = z.object({
  reason: z.string()
    .min(5, 'Motivo deve ter pelo menos 5 caracteres')
    .max(500, 'Motivo deve ter no máximo 500 caracteres')
});

const adjustCreditsSchema = z.object({
  amount: z.number()
    .int('Quantidade deve ser um número inteiro')
    .min(-100000, 'Quantidade mínima: -100.000')
    .max(100000, 'Quantidade máxima: 100.000')
    .refine(val => val !== 0, 'Quantidade não pode ser zero'),
  reason: z.string()
    .min(10, 'Motivo deve ter pelo menos 10 caracteres')
    .max(500, 'Motivo deve ter no máximo 500 caracteres')
});

const getUsersSchema = z.object({
  page: z.string().transform(val => parseInt(val)).optional(),
  limit: z.string()
    .transform(val => parseInt(val))
    .refine(val => val <= 100, 'Limite máximo: 100 usuários')
    .optional(),
  role: z.enum(['user', 'admin']).optional(),
  isActive: z.enum(['true', 'false']).optional(),
  search: z.string()
    .min(2, 'Busca deve ter pelo menos 2 caracteres')
    .max(50, 'Busca deve ter no máximo 50 caracteres')
    .optional()
});

module.exports = {
  banUserSchema,
  adminActionSchema,
  adjustCreditsSchema,
  getUsersSchema
};