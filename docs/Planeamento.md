# Planeamento exaustivo

Plataforma de Gestão e Disponibilização de Recursos Educativos

Este documento é uma revisão completa do planeamento do projeto, cruzando o enunciado com o estado real de `ProjetoEW` e com os padrões reutilizados nas aulas. O objectivo não é só listar tarefas, mas ordenar a implementação de forma gradual, testável e defensável, com dependências claras entre fases.

## 1. Leitura do enunciado e implicações práticas

O enunciado pede uma plataforma alinhada com o modelo OAIS, o que implica distinguir claramente três processos:

- Ingestão: aceitar um SIP em ZIP, validar o manifesto e a estrutura, rejeitar pacotes inválidos com relatório de erros e, quando o pacote for válido, transformá-lo num AIP guardado na plataforma.
- Administração: operar sobre os recursos armazenados com CRUD completo, controlo de autorização e capacidade de alterar os metadados e o estado do recurso.
- Disseminação: exportar um AIP para DIP; na versão inicial, DIP pode ser equivalente a SIP, desde que o sistema consiga importar e exportar o mesmo pacote.

Além disso, o enunciado exige funcionalidades transversais que não podem ficar para o fim:

- autenticação de utilizadores;
- pelo menos três perfis de acesso;
- exportação e importação global dos dados;
- posts, comentários e ranking;
- dataset de demonstração com algumas dezenas de entradas reais.

Isto significa que o projeto não deve ser tratado como “uma API com páginas”, mas como um sistema com ciclo de vida completo de conteúdo: submissão, validação, armazenamento, consulta, interacção social, avaliação, exportação e recuperação.

## 2. O que o repositório já faz hoje

A análise do código mostra que o projeto já está mais próximo de uma base funcional do que de um esqueleto vazio.

### 2.1 Estrutura actual

- `api-dados`: serviço Express + MongoDB para recursos e posts.
- `auth`: serviço separado para registo, login e gestão de utilizadores.
- `interface`: aplicação Express com Pug que consome a API via Axios.

### 2.2 Funcionalidades já presentes

- autenticação com JWT e cookie de sessão na interface;
- modelo de utilizador com `role`, `filiacao`, `dataRegisto`, `dataUltimoAcesso` e `password` com hash;
- modelo de recurso com `tipo`, `hashtags`, `ratings`, `mediaEstrelas`, `visibilidade` e `autor`;
- modelo de post com comentários;
- listagem, detalhe, criação, edição e remoção de recursos;
- filtros de recursos por texto, tipo, hashtag, ano, autor e ordenação;
- avaliação por estrelas na API;
- ingestão SIP com validação em camadas, criação de `Recurso` e registo de `AIP`;
- consulta de AIPs e relatórios de validação na API;
- exportação DIP por recurso, exportação múltipla, histórico de exportações e exportação de todos os recursos do utilizador;
- fase inicial de disseminação alinhada com `DIP ≈ SIP` no fluxo principal da interface;
- Swagger em `auth` e `api-dados`;
- interface Pug funcional para login, recursos, posts, utilizadores e exportação DIP.

### 2.3 Lacunas visíveis

- ainda não existe uma interface própria para submissão SIP, histórico de AIPs e consulta visual dos relatórios;
- ainda não existe importação inversa garantida do mesmo pacote exportado em DIP;
- ainda não existe exportação global de toda a informação da plataforma num único fluxo administrativo;
- o DIP atual é funcional para disseminação, mas não está alinhado com re-ingestão directa pelo mesmo `manifest.json` esperado no SIP;
- os tipos de recurso continuam fixos em `enum`, pelo que ainda não há mecanismo real para acrescentar novos tipos sem mexer no código;
- a homepage ainda não implementa o bloco de notícias pedido no enunciado;
- o ranking existe no backend, mas a interface ainda não expõe de forma clara o acto de avaliar um recurso;
- a pesquisa e filtragem na interface ainda estão abaixo do que a API já suporta;
- falta dataset realista com seed automatizada;
- faltam testes automatizados;
- falta fechar a documentação final orientada para a defesa e para a entrega.

### 2.4 Estado face ao enunciado

#### Requisitos já cumpridos

- autenticação com username/password;
- três perfis de acesso (`admin`, `produtor`, `consumidor`);
- CRUD de recursos;
- posts e comentários;
- ranking por estrelas ao nível da API;
- ingestão SIP com validação e criação de AIP;
- disseminação DIP com exportação por recurso;
- distinção conceptual entre `SIP`, `AIP` e `DIP`.

#### Requisitos parcialmente cumpridos

- exportação: existe por recurso, por lote e para todos os recursos do utilizador, mas não para toda a plataforma;
- pesquisa e classificação: a API suporta mais filtros do que a interface expõe;
- autorização por papéis: a base está montada, mas ainda há fluxos de interface e de UX por fechar;
- disseminação OAIS: existe exportação DIP, mas falta o fecho do ciclo “exportar e voltar a importar o mesmo pacote”.

#### Requisitos ainda em falta

- importar pelo processo inverso o mesmo pacote exportado;
- exportar toda a informação de forma administrativa/global;
- permitir acrescentar novos tipos de recurso sem alterar código;
- notícias na página principal;
- dataset de demonstração com dezenas de entradas reais;
- testes automatizados;
- interface para ingestão SIP e consulta de AIPs.

## 3. Padrões das aulas que fazem sentido reutilizar

O projeto encaixa bem nos padrões usados ao longo das aulas e convém explicitá-lo no planeamento para evitar soluções demasiado ambiciosas ou desalinhadas.

- Semana 2 e Semana 3: uso de Axios para consumir APIs REST e estruturar pedidos GET/POST/PUT/DELETE de forma simples.
- Semana 9 e Semana 10: autenticação com Pug, cookies e JWT, incluindo redireccionamento após login.
- Semana 11: separação entre serviço de autenticação, interface web e armazenamento em MongoDB, com suporte a Docker.
- Semana 11 e Semana 12: upload de ficheiros com Multer e armazenamento em disco, com adaptação possível para pacotes ZIP e estruturas de ingestão.
- Vários exemplos de aula: uso de Express, routes organizadas por domínio, e páginas Pug para MVP rápido.

Conclusão prática: a estratégia mais segura é começar por consolidar o MVP com os padrões já dominados nas aulas, e só depois acrescentar ingestão, exportação e automação mais complexa.

## 4. Decisão de arquitectura

Para este projeto, a arquitectura deve manter a separação já existente:

- `auth` fica responsável por criar e autenticar utilizadores, emitir tokens e gerir a informação sensível.
- `api-dados` fica responsável pelos dados do domínio, isto é, recursos, posts, comentários, ratings, ingestão e exportação.
- `interface` fica responsável pela experiência de utilização, encaminhando pedidos para os serviços anteriores.

Esta separação é boa porque permite evoluir cada serviço de forma independente. Também facilita a avaliação: autenticamos num serviço, persistimos noutro e apresentamos no terceiro.

## 5. Roadmap de implementação gradual

### Fase 0 — Normalização do ambiente e base técnica

Objectivo: garantir que a base executa localmente sem ambiguidades de configuração.

Tarefas:

- confirmar o `docker-compose.yml` da raiz e estabilizar portas, nomes de serviços, rede Docker e variáveis de ambiente;
- uniformizar nomes de cookie e secret JWT entre `auth`, `api-dados` e `interface`;
- confirmar a ligação a MongoDB e a persistência de volume;
- documentar os comandos mínimos para arrancar o sistema em desenvolvimento;
- identificar os ficheiros de configuração que ainda faltam no repositório, como README de raiz e instruções de execução.

Critério de aceitação:

- os três serviços arrancam;
- a interface abre no browser;
- login, listagem e detalhe de recursos respondem sem erro estrutural.

### Fase 1 — MVP funcional e demonstrável

Objectivo: ter uma versão pequena, mas completa o suficiente para uma demonstração inicial.

Tarefas:

- garantir que a API responde em `/recursos`, `/posts` e nos endpoints de autenticação;
- garantir que a interface Pug consegue listar recursos, ver detalhe, fazer login e registo;
- garantir que a navegação não quebra quando o utilizador não está autenticado;
- definir mensagens de erro simples e consistentes para os fluxos mais frequentes;
- preparar uma página principal com atalhos para as áreas essenciais da plataforma.

Entregável desta fase:

- MVP navegável com autenticação, consulta de recursos e criação de posts de forma básica.

### Fase 2 — Autenticação, perfis e autorização

Objectivo: tornar os níveis de acesso do enunciado reais e não apenas informativos.

Tarefas:

- validar o modelo de utilizador para garantir os campos obrigatórios do enunciado: nome, email, filiação, nível, dataRegisto, dataUltimoAcesso e password;
- confirmar que os perfis são, no mínimo, `admin`, `produtor` e `consumidor`;
- fazer com que o token transporte a informação necessária para decisões de autorização;
- aplicar middleware de autorização em todos os endpoints que alteram dados;
- garantir que um produtor só altera os recursos próprios e que um consumidor apenas consulta ou descarrega o que a visibilidade permite;
- acrescentar protecção na interface para esconder opções que o utilizador não pode executar.

Critério de aceitação:

- um consumidor não consegue criar, editar ou apagar recursos;
- um produtor pode gerir os seus recursos;
- um admin consegue actuar sobre tudo.

### Fase 3 — Modelo de dados e CRUD do domínio

Objectivo: fechar o ciclo de vida dos conteúdos antes de avançar para ingestão complexa.

Tarefas:

- rever o modelo de recurso para confirmar tipos, visibilidade, datas, hashtags, produtor, ratings e média;
- rever o modelo de post e comentários;
- melhorar filtros de listagem por ano, tipo, hashtags, visibilidade e produtor;
- consolidar ordenações úteis para a interface, como data de registo, média de estrelas e relevância;
- acrescentar validações de dados nos controladores para evitar lixo persistido na base de dados;
- se necessário, criar índices MongoDB para os campos mais consultados.

Critério de aceitação:

- os recursos podem ser listados, consultados, criados, editados e removidos;
- os posts e comentários funcionam em associação com um recurso;
- as avaliações por estrelas alteram a média calculada.

### Fase 4 — Ingestão SIP

Objectivo: implementar o processo mais distintivo do enunciado.

Tarefas:

- definir uma estrutura mínima de SIP baseada em ZIP com manifesto e lista de ficheiros;
- escolher um manifesto simples e legível, por exemplo em JSON, desde que seja estável e validável;
- receber o ZIP na API com upload controlado;
- descompactar temporariamente o pacote e validar a correspondência entre manifesto e ficheiros reais;
- validar campos obrigatórios do recurso a criar;
- verificar extensões, tamanhos máximos e existência de ficheiros referidos no manifesto;
- separar erros por categoria: estrutura, metadados, segurança e consistência;
- em caso de falha, devolver relatório de validação claro para o produtor;
- em caso de sucesso, transformar o pacote num AIP e registar os metadados na base de dados.

Resultado esperado:

- o sistema deixa de aceitar apenas recursos avulsos e passa a aceitar submissões estruturadas.

### Fase 5 — Disseminação, exportação e importação

Objectivo: fechar o ciclo OAIS e responder directamente ao requisito de importação/exportação.

Tarefas:

- exportar um recurso individual ou um conjunto de recursos para ZIP;
- incluir no ZIP os ficheiros necessários e o manifesto correspondente;
- permitir que o processo de importação reutilize a mesma estrutura usada na ingestão;
- normalizar a noção de DIP para a primeira versão do sistema, admitindo equivalência prática com SIP;
- garantir que o utilizador pode descarregar apenas o que a política de visibilidade permite.

Critério de aceitação:

- um recurso exportado pode voltar a ser importado sem perda relevante de metadados;
- o formato produzido é suficientemente estável para servir como demonstração.

### Fase 6 — Interacção social: posts, comentários, ranking e notícias

Objectivo: dar vida à plataforma para além da consulta estática.

Tarefas:

- melhorar a criação de posts associados a um recurso;
- permitir comentários aos posts com regras simples de autoria;
- consolidar o sistema de estrelas para evitar votos duplicados ou inválidos;
- criar top N de recursos com base na média, número de votos ou combinação dos dois;
- definir um espaço para notícias automáticas na página principal, como novos recursos, top 3 do momento ou novos utilizadores.

Notas de implementação:

- as notícias podem começar por ser geradas pelo sistema apenas em memória ou consultadas a partir da base de dados;
- o ranking deve ser determinístico e compreensível para a demonstração.

### Fase 7 — Pesquisa, taxonomia e qualidade de informação

Objectivo: melhorar a utilidade real da plataforma quando o número de recursos crescer.

Tarefas:

- permitir pesquisa por título, subtítulo, tipo, ano, hashtags e produtor;
- considerar uma taxonomia mais organizada do que apenas hashtags soltas, se o dataset justificar;
- criar uma estratégia mínima de normalização de etiquetas;
- adicionar filtros na interface para não obrigar o utilizador a navegar recurso a recurso.

Critério de aceitação:

- com dezenas de registos, o utilizador consegue localizar rapidamente um recurso útil.

### Fase 8 — Dataset de demonstração

Objectivo: preparar conteúdo suficiente e credível para a defesa final.

Tarefas:

- reunir material real das UCs e dos exemplos sugeridos no enunciado;
- criar um dataset com variedade suficiente em tipo, ano, visibilidade e produtor;
- adicionar utilizadores de demonstração coerentes com os papéis do sistema;
- automatizar o carregamento inicial com scripts de seed;
- verificar se o dataset cobre os principais cenários de uso da interface e da API.

Notas práticas:

- o objectivo não é ter “muitos ficheiros”, mas sim diversidade útil;
- o dataset deve permitir mostrar listagem, consulta, post, comentário, rating, download e exportação.

### Fase 9 — Testes, validação e robustez

Objectivo: impedir que o projeto dependa apenas de testes manuais antes da defesa.

Tarefas:

- criar testes unitários para validação de manifesto, parsing e regras de ingestão;
- criar testes de integração para os fluxos principais: autenticação, criação de recurso, consulta, post, comentário, rating e exportação;
- validar casos de erro, como tokens inválidos, ficheiros em falta, manifestos incompletos e permissões insuficientes;
- confirmar que os endpoints devolvem códigos HTTP coerentes.

Critério de aceitação:

- os fluxos principais têm cobertura mínima e os erros mais prováveis são previsíveis.

### Fase 10 — Docker, operação e entrega

Objectivo: tornar a solução fácil de instalar e repetir.

Tarefas:

- rever os Dockerfiles e o `docker-compose` para garantir consistência entre desenvolvimento e demonstração;
- adicionar volumes para persistência de dados e uploads;
- separar claramente configurações de produção e de desenvolvimento;
- documentar variáveis de ambiente obrigatórias;
- preparar instruções finais de arranque, limpeza e demonstração.

### Fase 11 — Documentação e relatório

Objectivo: fechar o trabalho com uma narrativa clara da solução.

Tarefas:

- escrever um README de arranque do projeto;
- documentar a arquitectura dos três serviços;
- explicar o fluxo OAIS implementado;
- descrever as decisões de desenho, em particular a manutenção do MVP em Pug e a evolução futura para componentes mais ricos;
- incluir exemplos de uso dos endpoints mais importantes;
- resumir a preparação do dataset e dos testes;
- produzir o relatório final em Markdown com 4 a 6 páginas, orientado para a defesa.

## 6. Plano de execução por ordem realista

Se a implementação tiver de ser feita de forma incremental, esta é a ordem mais segura:

1. Estabilizar ambiente, Docker e autenticação.
2. Fechar o CRUD do domínio e a interface mínima.
3. Implementar ingestão SIP com validação forte.
4. Fechar exportação/importação DIP.
5. Melhorar ranking, pesquisa e notícias.
6. Gerar dataset, testes e documentação final.

Esta ordem evita o erro clássico de começar pela ingestão avançada antes de existir uma base de autenticação, persistência e consulta estável.

## 7. Checkpoints para defesa

### Checkpoint 1

- login e registo funcionais;
- listagem e detalhe de recursos;
- posts e comentários básicos;
- interface Pug utilizável;
- ambiente local reproduzível.

### Checkpoint 2

- autorização por perfil consolidada;
- CRUD de recursos estável;
- avaliação por estrelas;
- filtros e pesquisa;
- ingestão SIP funcional com validação mínima.

### Checkpoint 3

- exportação e importação do mesmo pacote;
- dataset de demonstração carregado;
- testes principais preparados;
- documentação e relatório completos.

## 8. Riscos e cuidados

- Ingestão demasiado complexa: o risco é querer validar tudo ao mesmo tempo. A solução é começar por um manifesto pequeno e expandir depois.
- Permissões inconsistentes: a autorização tem de existir no backend e não apenas na interface.
- Divergência entre serviços: cookies, JWT secret, URLs internas e nomes de variáveis devem ser uniformizados cedo.
- Dataset insuficiente: sem conteúdo realista, a defesa fica fraca mesmo com código funcional.
- Interface pouco convincente: a experiência em Pug deve ser simples, mas não pode parecer provisória.

## 9. Conclusão

O projeto já tem uma base valiosa e mais avançada do que este plano assumia originalmente: separação por serviços, autenticação autónoma, CRUD do domínio, ingestão SIP funcional, AIPs registados, disseminação DIP funcional e interface Pug utilizável. O principal trabalho que resta já não está no “núcleo mínimo”, mas sim no fecho dos requisitos que faltam para cumprir o enunciado de forma forte.

As prioridades reais passam agora por: re-ingestão do mesmo pacote exportado, exportação global da informação, interface de ingestão/AIPs, notícias, tipos de recurso extensíveis, dataset, testes e documentação final. Fechar estes pontos aproxima muito mais o projeto de uma defesa sólida do que continuar a expandir funcionalidades periféricas.
