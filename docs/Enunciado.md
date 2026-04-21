# Modelo comum a todas as propostas

Open Archival Information System

## Processo de ingestão
- Upload de pacotes na plataforma;
- estrutura do pacote deverá ser verificada contra o manifesto;
- Faça outras validações que entender por bem;
- Se tudo estiver bem o recurso é armazenado na plataforma ficando 
disponível para os utilizadores;
- Se houver erros de validação, um relatório de erros deverá ser enviado a 
quem fez a submissão.

## Processo de administração
-  Conjunto de operações, CRUD e outras, sobre os recursos armazenados: 
   -  Listar, Consultar, Inserir um novo, Alterar um existente, Apagar.
- Responsável também por converter um SIP num pacote armazenado (AIP).

## Processo de disseminação
- Conversão de um AIP num DIP;
- Numa fase inicial, considerem DIP = SIP.

## Funcionalidades comuns a todos os projetos
- Autenticação de utilizadores (perfis?);
- Possibilidade de exportar toda a informação;
- Possibilidade de importar pelo processo inverso.

# TEMA: Plataforma de Gestão e Disponibilização de Recursos Educativos

## Objetivos

- Disponibilizar recursos educativos de vários tipos: livros, artigos, aplicações, 
trabalhos de alunos, monografias, relatórios, ...
- Permitir adicionar novos tipos de recursos e novos recursos;
- Ter os recursos classificados por ano, tipo, tema, ... (utilização de hashtags 
ou de uma taxonomia classificativa);
- Permitir que um utilizador faça um Post sobre um recurso;
- Permitir que os outros utilizadores comentem Posts;
- Criar um sistema de ranking para os recursos (atribuição de estrelas pelos 
utilizadores);
- E o que a imaginação ditar...

## Submission Information Package (SIP)
- Um ficheiro ZIP que deve seguir uma determinada estrutura (muito básica);
- Baseiem-se no BagIt: https://tools.ietf.org/id/draft-kunze-bagit-16.html
- Não precisam de seguir os requisitos todos...
  - Um manifesto e uma lista de ficheiros...

## Dissemination Information Package (DIP)
- Semelhante/igual ao SIP;
- O sistema deverá conseguir importar e exportar o mesmo pacote

## Utilizadores
- O sistema deverá estar protegido com autenticação: username+password, 
chaveAPI, google, facebook, ...
- Deverão existir pelo menos 3 níveis de acesso:
1. Administrador - tem acesso a todas as operações;
2. Produtor (autor de recurso) - pode consultar tudo e executar todas as operações sobre os 
recursos de que é produtor/autor;
3. Consumidor - pode consultar e descarregar os recursos públicos.
- Dados sobre o utilizador a guardar (sugestão):
1. nome, email, filiação (estudante, docente, curso, departamento, ...), nível (administrador, 
produtor ou consumidor), dataRegisto (registo na plataforma), dataUltimoAcesso, password, 
outros campos que julgue necessários...

## Recursos educativos

- Podem ser de vários tipos: relatório, tese, artigo, aplicação, slides, 
teste/exame, problema resolvido, ... (defina um conjunto base e preveja o seu 
aumento);
- Metainformação comum a todos os recursos:
○ tipo, título, subtítulo (opcional), dataCriação, dataRegisto (entrada no sistema), visibilidade 
(público: todos podem ver e descarregar, privado: apenas disponível para administradores e 
seu produtor), produtor/autor, ...

## Notícias
- Na página principal, em local a definir e dependendo do design poderão 
aparecer notícias, criadas pelo admin ou geradas pelo sistema. Exemplos: 
  - Nova submissão: o produtor X acabou de disponibilizar um artigo entitulado “...”;
  - O novo top3 de recursos mais requisitados é ...
  - Foi registado mais um utilizador, o sistema tem agora...

## Dataset para a demonstração final
- Na demonstração final, a plataforma deverá ter algumas dezenas de entradas;
- Usem material real;
- Têm o material que circula pelos alunos de várias UCs;
- Têm o RepFichas do JCR: 
http://www.di.uminho.pt/~jcr/AULAS/didac/RepFichas/site/index-fichas.html
- Programas exemplo do JCR: 
http://www.di.uminho.pt/~jcr/AULAS/didac/programasC/index.htm
- Minitestes de Programação Imperativa: 
http://www.di.uminho.pt/~jcr/AULAS/didac/minitestesPI/
- Compiladores: http://www.di.uminho.pt/~jcr/AULAS/didac/compiladores/
- Têm os sites das UC deste ano com muito material:
  - https://epl.di.uminho.pt/~jcr/AULAS/EngWeb2023/
  - https://epl.di.uminho.pt/~jcr/AULAS/RPCW2023/aulas2023.html
  - https://epl.di.uminho.pt/~jcr/AULAS/ATP2022/
- Datasets: nesta UC há muitos...

# Submissão do Projeto

Como entregar o projeto:

1. A entrega será feita criando uma pasta no repositório git de cada aluno de nome "Projeto2026" 
e colocando nela tudo o que concerne ao projeto, datasets, código desenvolvido, ..., e o 
relatório (4 a 6 páginas em formato MarkDown - até podem usá-lo para documentar o Git); 
2. Além disto deverão enviar um email a "jcr@di.uminho.pt" com o assunto 
"ENGWEB2026-Projeto-Axxxxx-Ayyyyy-Azzzzz" com um ficheiro ZIP onde deverá estar todo o 
conteúdo do repositório Git (Axxxxx é o número de aluno de cada membro do grupo);
3. As defesas serão marcadas, em folha de cálculo própria que irei disponibilizar em breve, uma 
vez definida a data final de entrega;
4. Se por algum motivo, algum grupo não puder estar presente para a defesa nas semanas 
definidas, o grupo deverá articular comigo o quanto antes uma data que sirva a todos;
5. Todas as defesas serão realizadas em sessões presenciais;
6. A ausência na defesa do projeto implica uma não avaliação no projeto, a presença é 
obrigatória.