# ProjetoEW — Plataforma de Gestão e Disponibilização de Recursos Educativos

## 1. Enquadramento e objetivos

O **ProjetoEW** é uma plataforma de gestão e disponibilização de recursos educativos desenvolvida para responder ao enunciado da UC de Engenharia Web. O tema escolhido exige mais do que uma aplicação CRUD: o sistema deve permitir submeter recursos, validá-los, armazená-los, disponibilizá-los para consulta/download e exportar a informação preservada.

O trabalho é enquadrado no modelo **OAIS (Open Archival Information System)**, distinguindo três momentos principais:

- **Ingestão**: receção de um pacote SIP, validação do manifesto e dos ficheiros, criação do recurso e armazenamento do pacote preservado.
- **Administração**: gestão dos recursos armazenados, tipos, utilizadores e operações de manutenção.
- **Disseminação**: conversão do conteúdo preservado num DIP para download ou exportação.

A plataforma implementada procura fechar este ciclo de forma simples, demonstrável e coerente. Foram também implementadas funcionalidades específicas pedidas para o tema dos recursos educativos: tipos de recurso extensíveis, hashtags, posts, comentários, ranking por estrelas e notícias.

As instruções práticas de execução, endpoints e comandos de arranque encontram-se no [README do projeto](../README.md).

## 2. Arquitetura da solução

O sistema está dividido em três serviços principais, todos em Node.js/Express, com MongoDB como base de dados:

- **auth**: responsável pelo registo, login, emissão de JWT e gestão de utilizadores.
- **api-dados**: concentra a lógica de domínio: recursos, tipos, posts, notícias, ingestão SIP, AIPs e disseminação DIP.
- **interface**: aplicação web em Express + Pug que consome os serviços anteriores e fornece a experiência de utilização.

Esta separação foi uma decisão importante. O serviço de autenticação fica isolado da lógica dos recursos, enquanto a interface se limita a orquestrar chamadas HTTP e apresentar páginas. Assim, a API de dados continua testável e documentada, e a interface pode evoluir sem alterar diretamente a persistência.

A autenticação é feita com **JWT**, guardado pela interface em cookie. Os serviços partilham o mesmo segredo (`JWT_SECRET`), permitindo que a API valide pedidos autenticados. O projeto pode ser executado localmente serviço a serviço ou com `docker compose`, que arranca `interface`, `api-dados`, `auth` e `mongodb_api`.

## 3. Utilizadores e permissões

Foram implementados três níveis de acesso:

- **Administrador**: pode gerir toda a plataforma, incluindo tipos de recurso, AIPs, exportações e utilizadores.
- **Produtor**: pode submeter recursos e gerir os recursos de que é autor.
- **Consumidor**: pode consultar e descarregar recursos públicos.

Os recursos têm visibilidade `publico` ou `privado`. Recursos privados só ficam disponíveis para administradores e para o respetivo produtor. Esta regra é aplicada na interface, para esconder ações indevidas, e na API, para proteger operações sensíveis.

A página de perfil de cada utilizador apresenta os seus recursos publicados. Esta decisão torna a autoria visível e ajuda a demonstrar a relação entre utilizadores e recursos.

## 4. Modelo dos recursos educativos

Um recurso educativo tem metadados comuns, como:

- título;
- subtítulo;
- descrição;
- tipo;
- data de criação;
- data de registo;
- visibilidade;
- autor/produtor;
- hashtags;
- avaliações por estrelas;
- lista de ficheiros associados.

Uma decisão relevante foi permitir que **cada recurso tenha vários ficheiros**. Isto aproxima a plataforma de casos reais: um recurso pode incluir um PDF, imagens, código, ficheiros auxiliares ou documentação. A interface apresenta a lista dos ficheiros e permite fazer preview quando possível.

O preview funciona de forma diferente consoante o tipo:

- imagens são apresentadas inline;
- PDF é apresentado numa janela com scroll;
- ficheiros de texto, Markdown, JSON, CSV, XML e HTML são apresentados numa janela de leitura;
- outros formatos continuam disponíveis para download.

Esta opção melhora a consulta sem obrigar o utilizador a descarregar todos os ficheiros.

## 5. SIP, validação e criação de AIP

Baseado no conceito de BagIt, decidimos implementar o **SIP** como um ZIP com uma estrutura simples: um manifesto e uma lista de ficheiros. 

Foram ainda implementadas duas formas de ingestão. A primeira é a submissão de um **ZIP SIP completo**, indicada para utilizadores que já conhecem a estrutura esperada e querem controlar diretamente o pacote enviado. A segunda é um **formulário assistido**, onde o produtor preenche os metadados do recurso e escolhe os ficheiros, depois a aplicação gera internamente o SIP a partir dessa informação.

Esta segunda opção melhora a experiência de utilização porque o produtor não precisa de criar manualmente o ZIP nem escrever o manifesto. O sistema transforma os dados do formulário num pacote compatível com o fluxo de ingestão, mantendo a mesma lógica e a mesma validação aplicada aos SIPs enviados diretamente.

A importação inversa pedida no enunciado fica suportada por este mesmo fluxo: sempre que existir um pacote ZIP com a estrutura SIP esperada, ele pode ser submetido novamente à plataforma e passar pelo processo normal de validação, criação de recurso e registo de AIP.

O fluxo de ingestão é:

1. O produtor submete um ZIP SIP completo ou preenche o formulário assistido.
2. No caso do formulário, o sistema gera um SIP interno com manifesto e ficheiros.
3. A API valida o pacote SIP resultante.
4. O manifesto é analisado.
5. Os ficheiros referidos no manifesto são confirmados.
6. São feitas validações de estrutura, metadados, segurança e consistência.
7. Se houver erro, é devolvido um relatório de validação.
8. Se estiver tudo correto, é criado o recurso e registado um **AIP**.

O AIP funciona como o registo preservado da ingestão. Guarda o manifesto, o estado da validação, o produtor, o recurso associado, a localização de armazenamento e informação de rastreabilidade.

Esta separação entre recurso e AIP é importante: o recurso é a entidade visível na plataforma; o AIP é a memória arquivística do que foi ingerido.

## 6. Edição de recursos e versionamento de AIPs

Uma decisão central do projeto foi a forma de lidar com a edição de recursos. Editar um recurso pode alterar apenas metadados, mas também pode adicionar ou remover ficheiros. Como isso muda o estado arquivístico do recurso, a edição não deve simplesmente substituir silenciosamente a informação anterior.

Assim, sempre que um recurso é editado é criada uma **nova versão AIP**.

Cada novo AIP contém:

- `versao` incrementada;
- referência para `aipAnterior`;
- manifesto atualizado;
- lista final de ficheiros do recurso;
- motivo da atualização;
- data da nova versão.

O `sipId` das versões deriva do SIP original. Por exemplo:

```text
SIP-20260511-00001
SIP-20260511-00001-v2
SIP-20260511-00001-v3
```

Isto evita nomes baseados no título do recurso e mantém a rastreabilidade ligada ao pacote inicial. A ligação `aipAnterior` permite reconstruir o histórico de versões.

Outra decisão foi **não duplicar fisicamente todos os ficheiros a cada edição**. Os ficheiros mantidos continuam referenciados no local onde já estavam; apenas os ficheiros novos são guardados. A nova versão AIP é, portanto, uma nova fotografia lógica do estado do recurso, sem copiar desnecessariamente ficheiros inalterados.

Esta abordagem é simples, economiza espaço e continua mantém histórico e rastreabilidade.

## 7. Disseminação DIP

Na fase inicial prevista pelo enunciado, o **DIP pode ser igual ou semelhante ao SIP**. A implementação segue esta ideia.

Quando o recurso ainda corresponde ao SIP original, a exportação pode devolver o pacote preservado. Quando o recurso foi editado, o sistema constrói o DIP a partir da versão AIP mais recente, usando o manifesto e os ficheiros associados ao estado atual.

Foram implementadas várias formas de disseminação:

- exportação do recurso completo como DIP ZIP;
- exportação de todos os recursos de um utilizador;
- exportação de ficheiro individual;
- histórico de exportações.

Assim, para além do DIP completo, foi decidida a criação de uma opção de **download de ficheiro individual**. Esta opção é útil quando o utilizador não precisa de descarregar o pacote inteiro e quer apenas consultar ou obter um ficheiro específico do recurso. Assim, a disseminação continua a suportar o pacote completo, alinhado com o modelo AIP - DIP, mas também oferece um acesso mais prático e granular aos conteúdos.

## 8. Administração e exportação global

O enunciado refere explicitamente a possibilidade de **exportar toda a informação**. Para responder a este requisito foi criada uma área administrativa própria:

```text
/admin
```

Nesta área estão concentradas as operações que pertencem ao administrador:

- gestão de tipos de recurso;
- gestão de AIPs;
- exportação de dados;

A exportação ficou concentrada em:

```text
/admin/exportacao
```

Foram implementadas exportações de:

- utilizadores;
- metadados dos recursos;
- DIPs dos recursos;
- AIPs;
- notícias;
- históricos existentes, incluindo versões AIP, exportações DIP, posts, comentários e ratings.

Separar estas rotas num router administrativo foi uma decisão de organização. 

## 9. Tipos de recurso, posts, comentários e ranking

Os tipos de recurso são configuráveis por dados. O administrador pode criar, ativar e desativar tipos sem alterar código. Isto responde ao requisito de permitir novos tipos de recursos no futuro.

Para a componente social do enunciado foram implementados:

- posts associados a recursos;
- comentários nos posts;
- avaliação por estrelas;
- cálculo de média de avaliação;
- top 3 de recursos.

Estas funcionalidades tornam os recursos mais do que ficheiros armazenados. A plataforma passa a permitir discussão, classificação e descoberta de conteúdos com base em relevância ou popularidade.

## 10. Notícias

O enunciado sugere a existência de notícias criadas pelo administrador ou pelo sistema. A plataforma suporta ambos os casos.

Existem notícias manuais e notícias automáticas, por exemplo:

- nova submissão;
- recurso em destaque;
- recurso mais comentado;
- estatísticas da plataforma;
- tipo de recurso em destaque.

As notícias automáticas associadas a eventos, como a criação de um novo recurso, são geradas no momento em que esse evento acontece. Já as notícias agregadas, como estatísticas da plataforma ou tipo de recurso em destaque, são recalculadas quando a página de notícias é aberta, mas só são atualizadas se o conteúdo tiver mudado. Assim, os dados não ficam desatualizados e estas notícias não sobem artificialmente para o topo sempre que a página é visitada.

## 11. Documentação e Swagger

Foram mantidos dois Swagger:

- `api-dados`: recursos, tipos, ingestão, AIPs, disseminação, posts e notícias;
- `auth`: registo, login, utilizadores e promoções de perfil.

A documentação Swagger é útil para testar endpoints e para demonstrar rapidamente a cobertura funcional da API. Além disso, o repositório contém documentos Markdown auxiliares para planeamento, ingestão e disseminação.

## 12. Limitações e decisões assumidas

Algumas decisões foram tomadas para manter o projeto funcional e demonstrável:

- O DIP é uma aproximação ao SIP, conforme permitido no enunciado.
- O versionamento de AIPs é lógico e não duplica todos os ficheiros fisicamente.
- A exportação global é dividida por categorias em vez de gerar um único pacote universal.
- Os testes automatizados ainda são reduzidos; a validação foi sobretudo feita por execução e verificação dos fluxos principais.

Estas limitações são aceitáveis no contexto do projeto, porque preservam o essencial: autenticação, ingestão, validação, armazenamento, disseminação, administração e exportação.

## 13. Conclusão

O ProjetoEW concretiza uma plataforma coerente com o enunciado. O sistema permite gerir recursos educativos, classificá-los, discuti-los, avaliá-los e exportá-los. Mais importante, implementa o ciclo OAIS de forma compreensível.

As decisões mais relevantes foram permitir múltiplos ficheiros por recurso, criar uma nova versão AIP a cada edição, concentrar as exportações na área administrativa e manter a disseminação DIP simples mas funcional.

O resultado é uma aplicação navegável, documentada e preparada para demonstração, com uma separação clara entre autenticação, dados e interface.
