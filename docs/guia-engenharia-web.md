# Guia de Engenharia Web (Teoria + ProjetoEW)

Este guia explica, em linguagem simples, os conceitos base e como eles aparecem no ProjetoEW. O foco e: compreender arquitetura web, autenticacao, rotas, estrutura de ficheiros e o ciclo SIP/AIP/DIP.

## 1) Ideia base de uma aplicacao web

Uma aplicacao web tem normalmente 3 partes:

- **Interface (frontend)**: o que o utilizador ve e usa. Aqui e um servidor que rende paginas HTML com Pug.
- **API (backend)**: regras de negocio e acesso a dados. Aqui existem 2 APIs: `api-dados` e `auth`.
- **Base de dados**: onde os dados ficam. Aqui e MongoDB.

O utilizador fala com a interface. A interface fala com as APIs. As APIs falam com a base de dados.

## 2) Cliente, servidor e HTTP

- **Cliente**: o browser.
- **Servidor**: o Node.js a responder a pedidos.
- **HTTP**: o protocolo que define pedidos e respostas.

Cada pedido tem:
- **Metodo**: GET, POST, PUT, DELETE.
- **URL**: o caminho (rota).
- **Headers**: metadados (ex: `Authorization`).
- **Body**: dados enviados (ex: login, formularios).

## 3) O que e uma rota

Uma rota e um caminho que o servidor escuta. Exemplo:

- `GET /auth/login` -> mostra a pagina de login
- `POST /auth/login` -> recebe credenciais e tenta autenticar
- `GET /recursos` -> lista recursos

Cada rota chama uma funcao que decide o que responder.

## 4) O que e autenticacao

Autenticacao e provar quem es. O sistema usa **JWT** (JSON Web Token):

1. O utilizador faz login com username e password.
2. O servidor `auth` valida e devolve um token (JWT).
3. A interface guarda esse token num **cookie**.
4. Em pedidos protegidos, esse token e enviado para a API.
5. A API valida o token e permite ou bloqueia o acesso.

Sem token, nao ha acesso a rotas protegidas.

## 5) Estrutura do ProjetoEW

### Servicos

- **interface/**: paginas e rotas do frontend.
- **auth/**: autenticacao e gestao de utilizadores.
- **api-dados/**: recursos, posts e ingestao/disseminacao.
- **mongodb_api**: base de dados (via docker).

### Docker

O `docker-compose.yml` liga os servicos e variaveis de ambiente:

- `AUTH_URL`, `API_URL`, `COOKIE_NAME`, `JWT_SECRET`.
- Isso garante que todos falam entre si.

## 6) Interface (frontend)

### Ficheiros principais

- `interface/app.js`: arranque do servidor e middleware.
- `interface/routes/*.js`: rotas da interface.
- `interface/views/*.pug`: paginas HTML (templates).
- `interface/public/`: CSS e assets.

### Rotas principais

- `GET /` -> pagina inicial.
- `GET /auth/login` e `POST /auth/login`.
- `GET /auth/registo` e `POST /auth/registo`.
- `GET /auth/logout`.
- `GET /recursos` e restantes CRUD.
- `GET /utilizadores` (lista e detalhe).

### Middleware de autenticacao

A interface valida o cookie JWT antes de permitir rotas protegidas (`/recursos`, `/posts`, `/utilizadores`). Se nao ha token, redireciona para `/auth/login`.

## 7) Auth (servico de autenticacao)

### O que faz

- Registo e login.
- Emissao de JWT.
- CRUD de utilizadores (com controlo por role).

### Rotas principais (auth)

- `POST /users/register` -> cria conta.
- `POST /users/login` -> autentica e devolve token.
- `GET /users` -> lista (protegido).
- `PUT /users/:id` -> atualiza (admin).
- `DELETE /users/:id` -> remove (admin).

### Roles

- `admin`: permissao total.
- `produtor`: pode criar e gerir recursos.
- `consumidor`: pode consultar.

## 8) API de dados (recursos e posts)

### O que faz

- Guarda recursos, posts, AIPs e exportacoes.
- Implementa ingestao (SIP) e disseminacao (DIP).

### Rotas principais

- `GET /recursos` -> listar.
- `POST /recursos` -> criar (protegido).
- `GET /recursos/:id` -> detalhe.
- `POST /posts` -> criar post (protegido).
- `POST /posts/:id/comentarios` -> comentar.

## 9) SIP, AIP, DIP (teoria OAIS + aplicacao)

### Conceitos simples

- **SIP**: pacote que entra no sistema (submissao do produtor).
- **AIP**: pacote interno e validado que o sistema guarda.
- **DIP**: pacote que sai do sistema (download/disseminacao).

No modelo **OAIS**, o **DIP** nao tem de ser igual ao **SIP**, nem tem de incluir tudo o que foi submetido. O **DIP** representa apenas a versao disponibilizada ao utilizador final no processo de disseminacao, podendo ser uma selecao parcial ou uma transformacao do conteudo preservado no **AIP**. Isso permite a extracao seletiva de conteudos a partir do **AIP**, por exemplo entregar apenas um ficheiro individual do SIP original, em vez do pacote completo. Assim, o **DIP** pode conter um unico ficheiro, um subconjunto dos ficheiros originais, ou uma versao transformada, conforme o pedido do utilizador. Esta abordagem garante flexibilidade no acesso, sem comprometer a integridade do **AIP**.

### No ProjetoEW

- **SIP**: um ZIP com `manifest.json` e pasta `data/`.
- **AIP**: registo na BD + ficheiros guardados em `uploads/recursos/...`.
- **DIP**: ZIP gerado a partir do AIP, com metadados e checksums.

### Rota SIP

- `POST /ingestao/sip` (API de dados)
- Recebe ZIP, valida, cria recurso e AIP.

### Rota DIP

- `GET /disseminacao/recursos/:recursoId/exportar`
- Verifica permissao, gera ZIP e devolve ao utilizador.

## 10) Fluxo completo (de ponta a ponta)

1. Utilizador abre a interface.
2. Faz login -> token JWT guardado em cookie.
3. Interface usa token para chamar APIs.
4. Produtor submete SIP (ZIP) -> API valida e cria AIP.
5. Consumidor pede exportacao -> API gera DIP e devolve ZIP.

## 11) Como pensar como engenheiro web

- **Separacao de responsabilidades**: UI, API, dados.
- **Seguranca**: autenticar, autorizar, validar input.
- **Observabilidade**: logs e erros claros.
- **Contratos**: rotas e respostas previsiveis.
- **Resiliencia**: lidar com falhas sem crashar o sistema.

## 12) Checklist rapido para dominar este projeto

- Entender o papel de cada servico.
- Saber as rotas principais e o que cada uma faz.
- Saber como funciona o JWT e os cookies.
- Saber o que e SIP/AIP/DIP e o fluxo de ingestao/disseminacao.
- Conseguir explicar o fluxo de dados do browser ate a base de dados.
