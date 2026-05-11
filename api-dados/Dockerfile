# Imagem base
FROM node:22

# Diretório de trabalho
WORKDIR /app

# Copiar ficheiros de dependências
COPY api-dados/package*.json ./

# Instalar dependências
RUN npm install

# Copiar o código da API e os recursos seed usados no arranque
COPY api-dados/ ./
COPY docs/recursos ./docs/recursos

RUN chmod +x /app/docker-entrypoint.sh

# Expor a porta da API
EXPOSE 3001

# Comando para iniciar
ENTRYPOINT ["/app/docker-entrypoint.sh"]
CMD ["node", "app.js"]
