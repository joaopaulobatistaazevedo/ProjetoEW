# Imagem base
FROM node:22

# Diretório de trabalho
WORKDIR /app

# Copiar ficheiros de dependências
COPY package*.json ./

# Instalar dependências
RUN npm install

# Copiar o resto do código
COPY . .

# Expor a porta da API
EXPOSE 3000

# Comando para iniciar
CMD ["node", "server.js"]