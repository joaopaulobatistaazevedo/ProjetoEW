ProjetoEW — Plataforma de Gestão de Recursos Educativos

Arranque rápido (Docker)

1) Construir e arrancar todos os serviços (recomendado):

```bash
cd ProjetoEW
docker-compose up --build
```

2) Endpoints principais após arranque (por defeito):

- Interface (Pug): http://localhost:3000
- API de dados: http://localhost:3001
- Auth service: http://localhost:3002
- MongoDB (bind host): 27018 (mapeado para 27017 no container)

3) Execução sem Docker (desenvolvimento rápido)

Abra um terminal por serviço e execute:

```bash
# API de dados
cd ProjetoEW/api-dados
npm install
npm start

# Auth
cd ProjetoEW/auth
npm install
npm start

# Interface
cd ProjetoEW/interface
npm install
npm start
```

4) Variáveis de ambiente importantes (usadas no docker-compose.yml)

- `MONGO_URL` — URL de ligação ao MongoDB
- `JWT_SECRET` — segredo partilhado entre `auth` e `api-dados` para verificar tokens
- `COOKIE_NAME` — nome do cookie usado pela interface e pelo auth
- `API_URL` / `AUTH_URL` — URLs configuráveis da interface para apontar para os serviços

5) Verificações rápidas (smoke checks)

```bash
# 1. Ver API a correr
curl http://localhost:3001/

# 2. Ver Auth a correr
curl http://localhost:3002/

# 3. Ver interface (html)
# abrir http://localhost:3000 no browser
```

6) Notas

- Os serviços partilham o mesmo `JWT_SECRET` para validar tokens.
- Os uploads são guardados em `api-dados/uploads` por defeito.
- A interface já inclui submissão SIP e histórico de AIPs.
- A homepage mostra notícias automáticas com novos recursos, tendências e estatísticas.
- Para desenvolvimento local, usar `npm start` em cada serviço é suficiente; para demonstração, usar Docker.
