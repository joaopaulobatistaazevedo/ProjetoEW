# ProjetoEW — Plataforma de Gestão de Recursos Educativos

Aplicação web para submissão, gestão, preservação e disseminação de recursos educativos, seguindo uma simplificação do modelo OAIS:

- **SIP**: pacote submetido pelo produtor.
- **AIP**: pacote preservado pelo sistema, com histórico de versões.
- **DIP**: pacote exportado para consulta/download.

## Serviços

O projeto está dividido em três serviços Node.js, uma base de dados MongoDB e um gateway nginx:

- `interface`: aplicação web Express + Pug.
- `api-dados`: API de recursos, ingestão, disseminação, posts e notícias.
- `auth`: autenticação e gestão de utilizadores.
- `mongodb_api`: MongoDB usado pelos serviços.
- `gateway`: nginx simples que expõe a aplicação e encaminha pedidos para os serviços internos.

## Arranque Rápido

```bash
cd ProjetoEW
docker compose up -d --build
```

Depois de arrancar, aceder sempre pelo gateway:

- Interface: http://localhost:3000
- API de dados via gateway: http://localhost:3000/api-dados
- Auth service via gateway: http://localhost:3000/auth-service

Os serviços internos não ficam expostos diretamente ao exterior. A `interface`, a `api-dados`, o `auth` e o `mongodb_api` usam `expose` no Docker Compose, ficando acessíveis apenas dentro da rede Docker. Só o `gateway` usa `ports`, ligado a `127.0.0.1:3000`, para permitir acesso local pelo browser.

Parar os serviços:

```bash
docker compose down
```

## Funcionalidades Principais

- Registo, login e gestão de utilizadores.
- Perfis de utilizador com listagem dos recursos publicados.
- Submissão de recursos por formulário ou por SIP ZIP.
- Criação automática de AIP após ingestão.
- Edição de recursos com adição/remoção de ficheiros e criação de nova versão AIP.
- Histórico de AIPs por recurso, com referência ao AIP anterior.
- Download de DIP completo do recurso.
- Download de ficheiro individual.
- Preview inline de imagens, PDF e ficheiros de texto (`txt`, `md`, `csv`, `json`, `xml`, `html`).
- Posts, comentários e avaliações por estrelas.
- Notícias automáticas de estatísticas, rankings, comentários e tipos em destaque.
- Área de administração.
- Exportação administrativa de dados.

## Administração

A área administrativa está disponível em:

```text
/admin
```

Inclui:

- `/admin/tiposrecursos`: gestão de tipos de recurso.
- `/admin/gestaoaips`: gestão/listagem administrativa de AIPs.
- `/admin/exportacao`: exportação de dados.

Exportações disponíveis:

- utilizadores em JSON;
- metadados de recursos em JSON;
- DIPs dos recursos em ZIP;
- AIPs em JSON;
- notícias em JSON;
- históricos em JSON, incluindo versões AIP, exportações DIP, posts, comentários e ratings.

## Rotas Relevantes da Interface

- `/recursos`: listagem e pesquisa de recursos.
- `/recursos/novo`: escolha do modo de submissão.
- `/recursos/ingestao-form`: submissão assistida por formulário.
- `/recursos/form`: submissão SIP ZIP.
- `/recursos/:id`: detalhe do recurso.
- `/recursos/:id/editar`: edição do recurso.
- `/recursos/:id/exportar-dip`: download do DIP completo.
- `/recursos/:id/ficheiros/:indice/download`: download de ficheiro individual.
- `/utilizadores/:id`: perfil do utilizador e recursos publicados.
- `/noticias`: notícias da plataforma.

## APIs e Swagger

Documentação Swagger:

- API de dados: http://localhost:3000/api-dados/docs
- Auth service: http://localhost:3000/auth-service/docs

JSON OpenAPI:

- API de dados: http://localhost:3000/api-dados/docs.json
- Auth service: http://localhost:3000/auth-service/docs.json

Áreas documentadas na API de dados:

- recursos;
- tipos de recurso;
- ingestão SIP/formulário;
- AIPs e histórico AIP;
- disseminação/exportação DIP;
- posts e comentários;
- notícias.

Áreas documentadas no Auth:

- registo;
- login/logout;
- utilizadores;
- atualização/remoção;
- promoção para produtor/admin.

## Variáveis de Ambiente

Usadas no `docker-compose.yml`:

- `MONGO_URL`: URL de ligação ao MongoDB.
- `JWT_SECRET`: segredo partilhado entre `auth`, `api-dados` e `interface`.
- `COOKIE_NAME`: nome do cookie de autenticação.
- `API_URL`: URL usada pela interface para contactar a API de dados.
- `AUTH_URL`: URL usada pela interface para contactar o serviço de auth.
- `INTERFACE_URL`: URL interna/externa da interface.
- `INTERNAL_NEWS_SECRET`: segredo usado para criação interna de notícias.
- `SWAGGER_URL`: URL pública usada pelos Swagger atrás do gateway.

## Armazenamento

- Uploads e ficheiros preservados ficam em `api-dados/uploads`.
- Em Docker, os uploads usam o volume `api_dados_uploads`.
- Os dados MongoDB usam o volume `mongodb_api_data`.
