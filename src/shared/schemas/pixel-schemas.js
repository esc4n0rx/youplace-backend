const { z } = require('zod');

const paintPixelSchema = z.object({
  x: z.number()
    .int('Coordenada X deve ser um número inteiro')
    .min(-180000, 'Coordenada X fora do limite mínimo')
    .max(180000, 'Coordenada X fora do limite máximo'),
  y: z.number()
    .int('Coordenada Y deve ser um número inteiro')
    .min(-90000, 'Coordenada Y fora do limite mínimo')
    .max(90000, 'Coordenada Y fora do limite máximo'),
  color: z.string()
    .regex(/^#[0-9A-F]{6}$/i, 'Cor deve estar no formato hexadecimal #RRGGBB')
});

const getAreaPixelsSchema = z.object({
  minX: z.string().transform(val => parseInt(val)),
  maxX: z.string().transform(val => parseInt(val)),
  minY: z.string().transform(val => parseInt(val)),
  maxY: z.string().transform(val => parseInt(val))
}).refine(data => {
  const areaWidth = Math.abs(data.maxX - data.minX);
  const areaHeight = Math.abs(data.maxY - data.minY);
  return areaWidth <= 100 && areaHeight <= 100;
}, {
  message: 'Área muito grande. Máximo 100x100 pixels'
});

const pixelCoordinatesSchema = z.object({
  x: z.string().transform(val => parseInt(val)),
  y: z.string().transform(val => parseInt(val))
});

module.exports = {
  paintPixelSchema,
  getAreaPixelsSchema,
  pixelCoordinatesSchema
};