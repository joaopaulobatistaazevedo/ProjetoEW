# Guia de Engenharia Web no ProjetoEW

Este guia foi reescrito para bater certo com o estado atual do projeto. A ideia e servir como mapa de leitura: o que existe, como as pecas comunicam, onde esta cada responsabilidade e como seguir os fluxos mais importantes sem te perderes.

## 1) O que e este projeto

O `ProjetoEW` e uma plataforma de recursos educativos com tres areas principais:

- autenticacao e gestao de utilizadores;
- gestao de recursos e discussoes;
- ingestao e disseminacao de pacotes OAIS (`SIP`, `AIP`, `DIP`).

Do ponto de vista tecnico, o projeto esta dividido em tres servicos Node.js e uma base de dados MongoDB:

- `interface/`: frontend server-side com Express + Pug;
- `api-dados/`: API principal dos recursos, posts, ingestao e disseminacao;
- `auth/`: servico de autenticacao e utilizadores;
- `mongodb_api`: MongoDB usado pelos dois servicos backend.

## 2) Arquitetura geral

O fluxo normal de uma aplicacao aqui e este:

```text
Browser
  -> interface (renderiza paginas Pug)
  -> auth (quando ha login/registo)
  -> api-dados (quando ha recursos, posts, SIP, DIP)
  -> MongoDB
```

Ou seja:

- o browser fala primeiro com a `interface`;
- a `interface` chama os outros servicos por HTTP;
- `auth` e `api-dados` falam com MongoDB;
- o utilizador nao fala diretamente com MongoDB.

## 3) Portas e servicos

No `docker-compose.yml`, a configuracao principal e esta:

- `interface`: porta externa `3000`
- `api-dados`: porta externa `3001`
- `auth`: porta externa `3002`, mas no container corre na `2623`
- `mongodb_api`: porta externa `27018`, mapeada para `27017` no container

Variaveis importantes:

- `API_URL=http://api-dados:3001`
- `AUTH_URL=http://auth:2623/users`
- `COOKIE_NAME=token`
- `JWT_SECRET=jcr_secret_2026`
- `MONGO_URL=mongodb://mongodb_api:27017/recursos_educativos`

Isto significa que:

- a `interface` envia pedidos para `api-dados` e `auth`;
- `auth` e `api-dados` partilham o mesmo `JWT_SECRET`;
- o cookie de sessao usado no projeto chama-se `token`.

## 4) Estrutura de pastas

### `interface/`

Responsavel por renderizar HTML no servidor e servir CSS.

Ficheiros-chave:

- `interface/app.js`: arranque da interface, middleware, Pug, cookie parsing e verificacao de autenticacao.
- `interface/routes/index.js`: homepage.
- `interface/routes/auth.js`: login, registo e logout.
- `interface/routes/recursos.js`: listagem, detalhe, CRUD e proxy de exportacao DIP.
- `interface/routes/posts.js`: envio de posts e comentarios a partir dos formularios.
- `interface/routes/utilizadores.js`: listagem e detalhe de utilizadores.
- `interface/views/`: templates Pug.
- `interface/public/stylesheets/style.css`: CSS global.

### `api-dados/`

Responsavel pela logica de negocio principal.

Ficheiros-chave:

- `api-dados/app.js`: arranque da API, ligacao a MongoDB e registo das rotas.
- `api-dados/routes/recursos.js`: rotas dos recursos.
- `api-dados/routes/posts.js`: rotas dos posts.
- `api-dados/routes/ingestao.js`: rotas SIP e consulta de AIPs.
- `api-dados/routes/disseminacao.js`: rotas DIP e auditoria de exportacoes.
- `api-dados/controllers/`: recebe o pedido HTTP e devolve resposta.
- `api-dados/services/`: concentra logica de validacao, processamento, permissao e ZIP.
- `api-dados/models/`: schemas Mongoose.

### `auth/`

Responsavel por utilizadores, login e emissao de JWT.

Ficheiros-chave:

- `auth/auth_server.js`: arranque do servico e criacao do admin base.
- `auth/routes/users.js`: rotas `/users`.
- `auth/controllers/utilizador.js`: acesso e operacoes sobre utilizadores.
- `auth/auth/auth.js`: middleware para verificar token e permissao admin.
- `auth/models/utilizador.js`: schema do utilizador.

## 5) Como funciona a autenticacao

O projeto usa `JWT` e `cookies`.

Fluxo real:

1. O utilizador abre `/auth/login` na `interface`.
2. O formulario faz `POST /auth/login` na `interface`.
3. A `interface` envia as credenciais para `auth` em `POST /users/login`.
4. O `auth` valida as credenciais, gera um `JWT` e devolve o token.
5. A `interface` guarda esse token no cookie `token`.
6. Quando o utilizador entra numa rota protegida, a `interface` valida o cookie com `jsonwebtoken`.
7. Quando precisa de chamar a `api-dados`, a `interface` envia o token em `Authorization: Bearer ...`.
8. A `api-dados` valida o token no middleware `authenticate`.

Isto e importante: a `interface` faz uma validacao local do cookie para proteger paginas, mas a validacao definitiva da autorizacao acontece tambem no backend que recebe o pedido.

### O que o servico `auth` expoe

As rotas mais importantes do servico `auth` sao:

- `POST /users/register`
- `POST /users/login`
- `GET /users/logout`
- `GET /users`
- `GET /users/:id`
- `PUT /users/:id`
- `DELETE /users/:id`
- `PUT /users/:id/promote/produtor`
- `PUT /users/:id/promote/admin`

No arranque, `auth/auth_server.js` tambem garante a existencia de um `admin` base. Por defeito, se nao existir nenhum admin na base de dados, cria um utilizador `admin` com password `admin`.

## 6) Roles no projeto

Existem tres roles:

- `admin`: permissao total;
- `produtor`: utilizador com capacidade de produzir/gerir recursos;
- `consumidor`: utilizador autenticado sem privilegios administrativos.

Regras importantes no estado atual:

- no registo, toda a gente entra como `consumidor`;
- quando um utilizador autenticado cria um recurso por `POST /recursos`, o sistema tenta promove-lo para `produtor`;
- recursos privados so podem ser geridos pelo autor ou por `admin`;
- exportacao de recursos privados tambem depende dessa permissao;
- na interface, a publicacao de discussoes esta exposta sobretudo para `produtor` e `admin`.

## 7) Interface: o que faz e como ler

A `interface` nao e uma SPA. E um servidor Express que renderiza HTML com Pug.

### Middleware principal

Em `interface/app.js`:

- ativa `logger`, `express.json`, `express.urlencoded` e `cookieParser`;
- define `views` e `view engine`;
- serve ficheiros estaticos de `public/`;
- verifica se existe cookie JWT para aceder a `/recursos`, `/posts` e `/utilizadores`;
- mete `res.locals.user` disponivel nas views.

### Rotas principais da interface

- `GET /`: pagina inicial com recursos publicos e top 3.
- `GET /auth/login`: formulario de login.
- `POST /auth/login`: envia credenciais ao servico `auth`.
- `GET /auth/registo`: formulario de registo.
- `POST /auth/registo`: cria conta no `auth`.
- `GET /auth/logout`: limpa cookie.
- `GET /recursos`: lista recursos.
- `GET /recursos/:id`: detalhe de um recurso, posts e opcoes de DIP.
- `GET /recursos/:id/exportar-dip`: proxy para descarregar o ZIP do DIP.
- `GET /utilizadores`: lista de utilizadores.

### Porque existe um proxy para o DIP na interface

Na vista de detalhe do recurso, o browser faz download atraves da `interface`, nao diretamente da `api-dados`. Isso permite:

- reutilizar o cookie da sessao;
- transformar o cookie em header `Authorization`;
- manter o fluxo consistente com o resto da aplicacao.

## 8) API de dados: o coracao funcional

Em `api-dados/app.js`, a API regista estas areas:

- `/recursos`
- `/posts`
- `/ingestao`
- `/disseminacao`

Tambem expõe Swagger em `/docs` e `/docs.json`.

### 8.1) Recursos

A entidade `Recurso` representa o objeto principal da plataforma.

Campos principais do modelo:

- `titulo`
- `subtitulo`
- `descricao`
- `tipo`
- `dataCriacao`
- `dataRegisto`
- `visibilidade`
- `autor`
- `hashtags`
- `ficheiro`
- `ratings`
- `mediaEstrelas`

Rotas principais:

- `GET /recursos`: lista com filtros
- `GET /recursos/top3`: top por media de estrelas
- `GET /recursos/:id`: detalhe
- `GET /recursos/:id/download`: download do ficheiro principal do recurso
- `POST /recursos`: criar recurso
- `PUT /recursos/:id`: editar
- `DELETE /recursos/:id`: apagar
- `PATCH /recursos/:id/rate`: avaliar

Filtros que o backend ja suporta em `GET /recursos`:

- `q`
- `tipo`
- `hashtag`
- `ano`
- `visibilidade`
- `autor` ou `produtor`
- `sort`
- `order`
- `limit`
- `page`

### 8.2) Posts

Os posts funcionam como discussoes associadas a recursos.

Rotas principais:

- `GET /posts`
- `GET /posts/:id`
- `POST /posts`
- `PUT /posts/:id`
- `DELETE /posts/:id`
- `POST /posts/:id/comentarios`
- `DELETE /posts/:id/comentarios/:cid`

No backend:

- criar post exige autenticacao;
- editar/apagar post exige ser autor ou `admin`;
- comentar exige autenticacao;
- apagar comentario exige ser autor do comentario ou `admin`.

## 9) OAIS no projeto: SIP, AIP e DIP

Esta parte e a mais importante para o enunciado.

### SIP

`SIP` significa `Submission Information Package`.

No projeto, e o pacote ZIP submetido na ingestao. Tipicamente contem:

- `manifest.json`
- `data/`
- opcionalmente `bagit.txt`
- opcionalmente `checksums.txt`

### AIP

`AIP` significa `Archival Information Package`.

No projeto, o `AIP` nao e apenas um ZIP guardado. E a combinacao de:

- um registo MongoDB na colecao `AIP`;
- os ficheiros preservados em `api-dados/uploads/recursos/{recursoId}/data/`;
- o manifesto original e o relatorio de validacao;
- informacao de rastreabilidade como `checksumSIP`, `dataIngestao` e `produtor`.

### DIP

`DIP` significa `Dissemination Information Package`.

Na fase inicial do projeto, estamos a trabalhar com a aproximacao pratica `DIP ≈ SIP`:

- o DIP e gerado a partir do AIP;
- o pacote exportado mantem a mesma estrutura base do SIP;
- o utilizador descarrega o pacote completo do recurso;
- a evolucao para DIP parcial ou transformado fica para fases seguintes.

Isto permite fechar primeiro o ciclo base `SIP -> AIP -> DIP` antes de introduzir variantes mais avancadas de disseminacao.

## 10) Ingestao SIP no codigo

O fluxo SIP esta repartido por varias pecas:

- `api-dados/routes/ingestao.js`
- `api-dados/controllers/ingestaoController.js`
- `api-dados/services/validadorSIP.js`
- `api-dados/services/sIPProcessor.js`
- `api-dados/models/aip.js`

### Endpoint principal

- `POST /ingestao/sip`

### O que acontece

1. O utilizador autenticado envia um ZIP.
2. O middleware `uploadZip` guarda o ficheiro temporariamente.
3. O `validadorSIP` valida:
   - estrutura;
   - metadados;
   - seguranca;
   - consistencia.
4. Se houver erro, o sistema devolve relatorio e pode registar um `AIP` com `status: erro`.
5. Se tudo estiver bem, o `sIPProcessor`:
   - cria um `Recurso`;
   - move os ficheiros para `uploads/recursos/{recursoId}/data/`;
   - cria um `AIP`;
   - remove o ZIP temporario.

### O que fica no AIP

No modelo `AIP`, os campos mais importantes sao:

- `sipId`
- `recursoId`
- `status`
- `dataIngestao`
- `produtor`
- `manifesto`
- `validacoes`
- `storageLocal`
- `relatorio`
- `checksumSIP`
- `downloadCount`

## 11) Disseminacao DIP no codigo

Aqui esta uma das partes mais interessantes do projeto atual.

Ficheiros principais:

- `api-dados/routes/disseminacao.js`
- `api-dados/controllers/disseminacaoController.js`
- `api-dados/services/disseminacaoService.js`
- `api-dados/services/verificacaoPermissoes.js`
- `api-dados/services/zipGenerator.js`
- `api-dados/models/exportacao.js`

### Rotas de disseminacao

- `GET /disseminacao/recursos/:recursoId/exportar`
- `GET /disseminacao/recursos/exportar-multiplos`
- `GET /disseminacao/recursos/:recursoId/historico-exportacoes`
- `GET /disseminacao/meus-recursos/exportar-todos`

### Exportacao na fase inicial

O endpoint `GET /disseminacao/recursos/:recursoId/exportar` devolve, nesta fase, um DIP completo equivalente ao SIP na estrutura base.

Antes de gerar o DIP, o sistema:

1. carrega o `AIP`;
2. carrega o `Recurso`;
3. valida permissao de acesso;
4. prepara checksums e caminhos locais;
5. inclui os ficheiros preservados no pacote completo;
6. chama o `zipGenerator` para montar:
   - `manifest.json`
   - `bagit.txt`
   - `checksums.txt`
   - `disseminacao.log`
   - pasta `data/` com os ficheiros incluidos
7. regista auditoria em `Exportacao`.

## 12) Permissoes e visibilidade

O projeto separa autenticacao de autorizacao.

Autenticacao responde a:

- "quem e o utilizador?"

Autorizacao responde a:

- "o que e que esse utilizador pode fazer?"

Exemplos reais do projeto:

- qualquer autenticado pode criar um recurso;
- so o autor ou `admin` pode editar/apagar um recurso;
- qualquer autenticado pode avaliar um recurso;
- recursos privados nao podem ser descarregados por qualquer utilizador;
- a disseminacao DIP passa por verificacao de permissao antes de tocar no AIP;
- a visibilidade do `Recurso` influencia o que pode ser exportado.

## 13) Base de dados: que colecoes existem

As colecoes principais sao:

- `Utilizador`
- `Recurso`
- `Post`
- `AIP`
- `Exportacao`

### Ligacoes importantes entre modelos

- um `Recurso` tem um `autor`;
- um `Post` pertence a um `Recurso` e a um `autor`;
- um `AIP` referencia um `Recurso` e um `produtor`;
- uma `Exportacao` referencia o `AIP`, o `Recurso` e quem exportou.

## 14) Fluxos completos que deves saber explicar

### Fluxo A: login

1. Utilizador submete credenciais na `interface`.
2. `interface` chama `auth`.
3. `auth` devolve JWT.
4. `interface` guarda cookie `token`.
5. Rotas protegidas passam a ficar disponiveis.

### Fluxo B: criar recurso

1. Utilizador autenticado abre o formulario.
2. `interface` envia `POST /recursos` para `api-dados`.
3. `api-dados` cria o `Recurso`.
4. Se o utilizador era `consumidor`, a API tenta promove-lo para `produtor` via `auth`.

### Fluxo C: ingerir SIP

1. Utilizador autenticado envia ZIP.
2. `api-dados` valida o pacote.
3. Se falhar, devolve relatorio.
4. Se passar, cria `Recurso` e `AIP`.
5. Os ficheiros ficam guardados em `uploads/recursos/...`.

### Fluxo D: exportar DIP

1. Utilizador abre detalhe do recurso na `interface`.
2. O utilizador escolhe exportar o DIP.
3. A `interface` chama a rota de exportacao com o token.
4. A `api-dados` gera o ZIP a partir do `AIP`.
5. A `interface` devolve o ficheiro ao browser.

## 15) Como ler o projeto sem te perderes

Se quiseres perceber o projeto por camadas, esta ordem funciona bem:

1. Ler `README.md` e `docker-compose.yml`.
2. Ler `interface/app.js` para perceber o frontend server-side.
3. Ler `interface/routes/auth.js` e `auth/routes/users.js` para perceber login.
4. Ler `api-dados/routes/recursos.js` e `api-dados/controllers/recursosController.js`.
5. Ler `api-dados/routes/posts.js` e `api-dados/controllers/postsController.js`.
6. Ler `api-dados/routes/ingestao.js`, `validadorSIP.js` e `sIPProcessor.js`.
7. Ler `api-dados/routes/disseminacao.js` e `disseminacaoService.js`.
8. No fim, olhar para os modelos Mongoose para consolidar a estrutura dos dados.

## 16) O que e importante perceber em Engenharia Web aqui

Este projeto e um bom exemplo de varios conceitos classicos:

- separacao entre interface, autenticacao e logica de negocio;
- comunicacao HTTP entre servicos;
- autenticacao com JWT;
- autorizacao por roles;
- persistencia com MongoDB;
- server-side rendering com Pug;
- organizacao por `routes`, `controllers`, `services` e `models`;
- pipeline de ingestao e disseminacao inspirado em OAIS.

## 17) Resumo final

Se tiveres de explicar o projeto em poucas frases, a ideia certa e esta:

- a `interface` mostra paginas e envia pedidos aos servicos;
- o `auth` trata de utilizadores e JWT;
- a `api-dados` trata de recursos, posts, SIP, AIP e DIP;
- MongoDB guarda os metadados;
- os ficheiros preservados ficam no filesystem em `api-dados/uploads/recursos`;
- o OAIS aparece no fluxo `SIP -> AIP -> DIP`;
- nesta fase inicial, o DIP e tratado como equivalente ao SIP na estrutura base.

## 18) Ficheiros que vale a pena abrir a seguir

Se quiseres continuar a estudar, os melhores proximos ficheiros sao:

- `interface/app.js`
- `interface/routes/recursos.js`
- `interface/views/recursos/detalhe.pug`
- `api-dados/controllers/recursosController.js`
- `api-dados/services/validadorSIP.js`
- `api-dados/services/sIPProcessor.js`
- `api-dados/services/disseminacaoService.js`
- `api-dados/services/zipGenerator.js`
- `api-dados/models/aip.js`
- `api-dados/models/exportacao.js`
