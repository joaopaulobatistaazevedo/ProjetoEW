# ProjetoEW — Plataforma de Gestão e Disponibilização de Recursos Educativos

## 1. Enquadramento

O projeto **ProjetoEW** foi desenvolvido no âmbito da UC de Engenharia Web com o objetivo de concretizar uma plataforma de gestão e disponibilização de recursos educativos alinhada com o modelo **OAIS (Open Archival Information System)**. A solução foi pensada para cobrir o ciclo completo do conteúdo digital: **ingestão**, **administração** e **disseminação**, respeitando os requisitos do enunciado e acrescentando funcionalidades extra que tornam a plataforma mais útil numa demonstração final.

A aplicação está organizada em três serviços principais:

- **auth**: serviço de autenticação e gestão de utilizadores;
- **api-dados**: serviço responsável pelos dados do domínio, ingestão SIP, AIPs, posts, notícias, recursos e exportação;
- **interface**: interface web em Express + Pug, que consome as APIs e apresenta a experiência de utilização.

Esta separação permite isolar responsabilidades, simplificar a manutenção e facilitar a demonstração do sistema em ambiente local ou em Docker.

## 2. Objectivo do sistema

A plataforma foi concebida para disponibilizar recursos educativos de vários tipos, como artigos, relatórios, aplicações, slides, testes, problemas resolvidos e outros formatos que possam ser adicionados no futuro. Para além da consulta e download de conteúdos, o sistema suporta:

- autenticação de utilizadores;
- controlo de permissões por perfis;
- criação, edição e remoção de recursos;
- publicação de posts sobre recursos;
- comentários a posts;
- avaliação por estrelas;
- notícias automáticas e manuais;
- ingestão de pacotes SIP em ZIP;
- registo de AIPs;
- exportação DIP;
- gestão de tipos de recurso;
- documentação completa da API em Swagger.

## 3. Arquitectura geral

A solução segue uma arquitectura web de três camadas lógicas:

1. **Apresentação** — a interface web fornece páginas para login, registo, listagem de recursos, detalhe de recursos, ingestão, exportação, gestão de utilizadores, notícias e administração.
2. **Domínio / API** — `api-dados` concentra a lógica de negócio e a persistência em MongoDB.
3. **Autenticação** — `auth` trata do registo, login, emissão e validação de JWT, bem como da gestão da informação sensível do utilizador.

A comunicação entre serviços é feita através de HTTP, com autenticação por JWT e cookie partilhado entre interface e backend. O projecto encontra-se preparado para execução em Docker, com `docker-compose.yml` na raiz do repositório.

## 4. Alinhamento com o enunciado

O enunciado pede uma plataforma associada ao modelo OAIS com ingestão, administração e disseminação. O projeto responde a esse pedido da seguinte forma:

- **Ingestão**: existe submissão de pacotes ZIP em formato SIP, validação estrutural e funcional, criação de recurso e registo de AIP.
- **Administração**: existem operações CRUD sobre recursos, tipos de recurso, utilizadores, posts e notícias, com controlo de permissões.
- **Disseminação**: existem fluxos de exportação DIP, exportação de recursos individuais e exportação em lote.
- **Autenticação**: o sistema suporta login, registo, logout e perfis de acesso.
- **Importação/exportação**: o sistema já suporta exportação estruturada e ingestão de ZIP, fechando grande parte do ciclo OAIS.
- **Documentação**: a API está documentada em Swagger para os serviços `auth` e `api-dados`.

## 5. Funcionalidades implementadas

### 5.1 Autenticação e gestão de utilizadores

O serviço de autenticação suporta registo e login de utilizadores, com emissão de tokens JWT e utilização de cookie para manter a sessão na interface.

O modelo de utilizador inclui dados como nome, email, filiação, nível de acesso, data de registo, data do último acesso e password encriptada. Foram considerados os três perfis pedidos no enunciado:

- **Administrador**: acesso total;
- **Produtor**: pode gerir os recursos da sua autoria;
- **Consumidor**: consulta e descarrega recursos públicos.

A interface inclui também páginas para lista e detalhe de utilizadores, edição e promoção de perfil, em linha com o papel administrativo do sistema.

### 5.2 Recursos educativos

Os recursos educativos são o núcleo da plataforma. O sistema permite:

- listar recursos com filtros;
- consultar detalhe de um recurso;
- criar novos recursos;
- editar recursos existentes;
- apagar recursos;
- descarregar recursos;
- fazer preview de ficheiros;
- avaliar recursos por estrelas;
- consultar o top 3 dos recursos mais valorizados.

O modelo de recurso suporta metainformação relevante para o domínio, incluindo tipo, título, subtítulo, hashtags, visibilidade, autor/produtor, datas e sistema de avaliação.

### 5.3 Tipos de recurso

Foi implementado um catálogo de tipos de recurso gerido por dados, com possibilidade de:

- listar tipos activos;
- consultar todos os tipos;
- criar novos tipos;
- alterar tipos existentes;
- activar ou desactivar tipos.

Esta abordagem cumpre o requisito de permitir o aumento futuro da taxonomia sem alterações profundas ao código.

### 5.4 Posts e comentários

A plataforma permite associar posts a recursos, bem como comentários aos posts. Este módulo acrescenta uma camada social ao sistema, permitindo que os utilizadores discutam e contextualizem os recursos publicados.

Entre as operações disponíveis estão:

- criação de posts;
- consulta de posts;
- edição de posts;
- remoção de posts;
- criação de comentários;
- remoção de comentários.

As operações são protegidas por autenticação e, nos casos aplicáveis, por regras de autoria ou administração.

### 5.5 Notícias

A página principal integra notícias, criadas manualmente por administradores ou geradas automaticamente pelo sistema. Este mecanismo é útil para destacar novidades na plataforma, como:

- novas submissões;
- recursos em destaque;
- novos utilizadores;
- tendências e top 3 de recursos.

Este bloco cumpre o requisito do enunciado relativo à presença de notícias na home page e acrescenta valor à apresentação do sistema.

### 5.6 Ingestão SIP e AIP

A ingestão é um dos componentes mais importantes do projeto. O sistema aceita submissões em ZIP através de um fluxo SIP, valida a estrutura do pacote e transforma a submissão num AIP interno após validação.

O processo inclui:

- upload do pacote ZIP;
- validação da estrutura do manifesto;
- validação de metadados;
- validação de consistência entre ficheiros e manifesto;
- verificação de regras de segurança e integridade;
- geração de relatório em caso de erro;
- criação do recurso quando a ingestão é válida;
- registo de AIP para rastreabilidade.

A interface inclui páginas específicas para submissão SIP e consulta de AIPs, permitindo acompanhar o historial de ingestão.

### 5.7 Disseminação DIP e exportação

A disseminação foi implementada com base na ideia de que, numa primeira versão, **DIP ≈ SIP**. O sistema permite exportar recursos em pacotes ZIP, respeitando a visibilidade e a autorização do utilizador.

O projeto suporta:

- exportação de um recurso individual;
- exportação em lote;
- exportação de todos os recursos de um utilizador;
- histórico de exportações;
- consulta de pacotes DIP e AIP na interface de administração.

Esta funcionalidade cumpre o espírito do OAIS e permite uma demonstração clara do ciclo de disponibilização de informação.

### 5.8 Administração global

A área administrativa concentra ferramentas para gestão transversal da plataforma. Entre as operações disponíveis estão:

- gestão de utilizadores;
- gestão de tipos de recurso;
- consulta de AIPs;
- exportação de utilizadores, recursos, DIPs, AIPs, notícias e históricos;
- supervisão geral do estado da plataforma.

Este módulo é relevante para o papel do administrador descrito no enunciado, porque reúne num único espaço as operações de controlo e manutenção.

## 6. Funcionalidades extra implementadas

Para além do mínimo pedido, o projecto inclui várias melhorias que enriquecem a utilização da plataforma:

- **preview de ficheiros** antes do download;
- **top 3 de recursos** com base na avaliação;
- **notícias automáticas** geradas pelo sistema;
- **importação por formulário** além da ingestão ZIP;
- **gestão de estados dos tipos de recurso**;
- **exportação detalhada por categorias administrativas**;
- **separação clara entre recursos públicos e privados**;
- **interface web navegável** para quase todas as operações principais;
- **documentação técnica em Markdown** para ingestão, disseminação e planeamento.

Estas extensões ajudam a demonstrar que a solução não se limita ao requisito base, mas procura dar uma resposta mais completa ao contexto da disciplina.

## 7. Interface web

A interface foi desenvolvida em **Express + Pug**, com rotas específicas por área funcional. A navegação cobre:

- autenticação;
- registo;
- listagem e detalhe de recursos;
- criação e edição;
- ingestão SIP;
- consulta de AIPs;
- exportação DIP;
- notícias;
- posts;
- utilizadores;
- administração.

Esta camada é importante porque torna a plataforma demonstrável sem depender apenas de chamadas diretas à API, o que é especialmente útil numa apresentação presencial.

## 8. Swagger e documentação técnica

Toda a API principal está documentada com **Swagger UI**, em dois módulos independentes:

- **auth**: documentação do serviço de autenticação;
- **api-dados**: documentação dos endpoints de domínio.

Isto significa que as rotas de login, registo, recursos, posts, ingestão, disseminação, notícias e tipos de recurso podem ser consultadas de forma centralizada e testadas diretamente a partir da documentação.

Além do Swagger, o repositório contém documentação adicional em Markdown, nomeadamente:

- `docs/Planeamento.md`
- `docs/Ingestao-SIP.md`
- `docs/Disseminacao-DIP.md`
- `docs/Enunciado.md`

## 9. Deploy e execução

O sistema está preparado para correr em Docker com os três serviços principais e MongoDB. Em desenvolvimento local, também pode ser executado serviço a serviço.

Os pontos principais de entrada são:

- interface web em `http://localhost:3000`;
- API de dados em `http://localhost:3001`;
- serviço de autenticação em `http://localhost:3002`.

Esta organização simplifica testes e demonstrações e garante que a plataforma pode ser arrancada de forma consistente.

## 10. Estado actual do projecto

O projeto apresenta uma base funcional sólida e alinhada com o enunciado. As áreas mais importantes do trabalho já estão implementadas e integradas:

- autenticação e perfis;
- recursos;
- posts e comentários;
- notícias;
- tipos de recurso;
- ingestão SIP;
- AIPs;
- disseminação DIP;
- exportação;
- documentação Swagger;
- interface web;
- suporte Docker.

Em termos de maturidade funcional, o sistema já se encontra preparado para uma demonstração abrangente das operações centrais da plataforma.

## 11. Conclusão

O **ProjetoEW** concretiza uma plataforma de gestão e disponibilização de recursos educativos com foco claro no modelo OAIS e nas necessidades descritas no enunciado. A solução não se limita a disponibilizar conteúdos: ela trata autenticação, perfis, ingestão estruturada, persistência, disseminação, interacção social e administração centralizada.

Do ponto de vista de entrega, o sistema tem documentação técnica organizada, Swagger para as APIs, interface web funcional e suporte para execução em Docker. Como resultado, o projeto está preparado para ser apresentado como uma plataforma coerente, extensível e alinhada com os objectivos pedagógicos da UC.