FROM node:22-alpine

# Cria o diretório da app
WORKDIR /usr/src/app

# Copia os ficheiros de dependências
COPY package*.json ./

# Instala as dependências
RUN npm install --production

# Copia o resto do código
COPY . .

# Garante que a pasta de uploads existe
RUN mkdir -p uploads

# Expõe a porta que definiste
EXPOSE 19001

CMD [ "node", "server.js" ]