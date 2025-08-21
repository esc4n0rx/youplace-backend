# Estágio 1: Build
# Usamos uma imagem Node.js LTS (Long Term Support) baseada em Alpine Linux por ser leve e segura.
FROM node:20-alpine AS build

# Define o diretório de trabalho dentro do container
WORKDIR /app

# Copia os arquivos de manifesto de pacotes
# Isso aproveita o cache do Docker. A reinstalação do npm só ocorrerá se houver mudanças nesses arquivos.
COPY package.json package-lock.json* ./

# Instala as dependências de produção
RUN npm install --production

# Copia o restante do código da aplicação
COPY . .

# Estágio 2: Produção
# Imagem final, também baseada em Alpine e na mesma versão do Node
FROM node:20-alpine

WORKDIR /app

# Define a variável de ambiente para produção
# Isso desativa logs de debug e otimiza algumas bibliotecas
ENV NODE_ENV=production

# Copia as dependências instaladas e o código do estágio de build
COPY --from=build /app .

# Expõe a porta em que a aplicação roda (conforme seu src/config/environment.js)
EXPOSE 5001

# Comando para iniciar a aplicação
# Usamos a forma de array para evitar problemas com shell
CMD ["node", "server.js"]
