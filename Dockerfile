# Multi-stage build para otimizar tamanho da imagem
FROM node:18-alpine AS base

# Adicionar ferramentas necessárias
RUN apk add --no-cache \
    dumb-init \
    curl \
    bash

# Criar usuário não-root
RUN addgroup -g 1001 -S nodejs && \
    adduser -S youplace -u 1001

# Definir diretório de trabalho
WORKDIR /app

# Copiar package files primeiro (cache layer)
COPY package*.json ./

# === DEVELOPMENT STAGE ===
FROM base AS development

# Instalar todas as dependências (incluindo devDependencies)
RUN npm ci --include=dev

# Verificar se nodemon foi instalado
RUN npx nodemon --version || npm install -g nodemon

# Copiar código fonte
COPY --chown=youplace:nodejs . .

# Criar diretório de logs
RUN mkdir -p logs && chown youplace:nodejs logs

# Expor porta
EXPOSE 3001

# Usuário não-root
USER youplace

# Comando para desenvolvimento (com nodemon)
CMD ["dumb-init", "npm", "run", "dev"]

# === PRODUCTION STAGE ===
FROM base AS production

# Instalar apenas dependencies de produção
RUN npm ci --omit=dev && npm cache clean --force

# Copiar código fonte
COPY --chown=youplace:nodejs . .

# Criar diretório de logs
RUN mkdir -p logs && chown youplace:nodejs logs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3001/api/v1/health || exit 1

# Expor porta
EXPOSE 3001

# Usuário não-root
USER youplace

# Comando para produção
CMD ["dumb-init", "npm", "start"]