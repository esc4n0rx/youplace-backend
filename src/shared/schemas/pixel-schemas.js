const { z } = require('zod');
const CoordinateSystem = require('../utils/coordinate-system');

// Instância do sistema de coordenadas para obter limites dinâmicos
const coordinateSystem = new CoordinateSystem();
const bounds = coordinateSystem.getPixelBounds();

const paintPixelSchema = z.object({
  x: z.number()
    .int('Coordenada X deve ser um número inteiro')
    .min(bounds.minX, `Coordenada X fora do limite mínimo (${bounds.minX})`)
    .max(bounds.maxX, `Coordenada X fora do limite máximo (${bounds.maxX})`),
  y: z.number()
    .int('Coordenada Y deve ser um número inteiro')
    .min(bounds.minY, `Coordenada Y fora do limite mínimo (${bounds.minY})`)
    .max(bounds.maxY, `Coordenada Y fora do limite máximo (${bounds.maxY})`),
  color: z.string()
    .regex(/^#[0-9A-F]{6}$/i, 'Cor deve estar no formato hexadecimal #RRGGBB')
});

// Schema para área de consulta com validação dinâmica
const getAreaPixelsSchema = z.object({
  minX: z.string().transform(val => parseInt(val)),
  maxX: z.string().transform(val => parseInt(val)),
  minY: z.string().transform(val => parseInt(val)),
  maxY: z.string().transform(val => parseInt(val))
}).refine(data => {
  // Validar se coordenadas estão dentro dos limites do sistema
  return coordinateSystem.isValidPixelCoordinate(data.minX, data.minY) &&
         coordinateSystem.isValidPixelCoordinate(data.maxX, data.maxY);
}, {
  message: `Coordenadas fora dos limites do sistema. Limites: X[${bounds.minX}, ${bounds.maxX}], Y[${bounds.minY}, ${bounds.maxY}]`
}).refine(data => {
  // Validar tamanho da área para performance
  const areaWidth = Math.abs(data.maxX - data.minX);
  const areaHeight = Math.abs(data.maxY - data.minY);
  return areaWidth <= 10000 && areaHeight <= 10000;
}, {
  message: 'Área muito grande para consulta. Máximo 10000x10000 pixels'
});

const pixelCoordinatesSchema = z.object({
  x: z.string().transform(val => parseInt(val)),
  y: z.string().transform(val => parseInt(val))
}).refine(data => {
  return coordinateSystem.isValidPixelCoordinate(data.x, data.y);
}, {
  message: `Coordenadas inválidas. Limites: X[${bounds.minX}, ${bounds.maxX}], Y[${bounds.minY}, ${bounds.maxY}]`
});

module.exports = {
  paintPixelSchema,
  getAreaPixelsSchema,
  pixelCoordinatesSchema
};