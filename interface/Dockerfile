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

# Expor a porta da interface
EXPOSE 8080

# Comando para iniciar
CMD ["node", "app.js"]