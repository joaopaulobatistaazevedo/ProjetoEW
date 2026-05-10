# TAREFAS PENDENTES — ProjetoEW

**Estado atual:** funcionalidades principais estabilizadas  
**Última revisão:** 8 de Maio de 2026

## Prioridade Alta

### 1. Validação ciclica SIP → AIP → DIP → SIP
- Confirmar que um DIP exportado volta a ser aceite como SIP
- Ajustar manifesto/estrutura se necessário
- Testar com um ZIP real exportado pela plataforma

### 2. Validar exportação DIP
- Confirmar que o botão aparece apenas quando permitido
- Testar download do ZIP no detalhe do recurso
- Verificar que admin/produtor/convidado não vêem opções indevidas

### 3. Dataset de demonstração
- Carregar dezenas de recursos reais
- Garantir variedade de tipos, anos, visibilidade e autores
- Incluir alguns posts, comentários e avaliações

## Prioridade Média

### 4. Testes automatizados
- Auth: login, registo e permissões
- Recursos: CRUD e rating
- Ingestão: SIP válido e inválido

### 5. Relatório final
- Resumir arquitetura, funcionalidades e decisões de implementação
- Explicar o que ficou concluído e o que ficou em aberto

### 6. Swagger e validações
- Completar exemplos e schemas
- Uniformizar respostas de erro e casos limite

## Já concluído

- Notícias automáticas na homepage
- Eliminação de utilizadores corrigida na interface de admin
- Ocultação de ações sem permissão
- Interface de ingestão SIP
- CRUD de recursos, posts, comentários e avaliação
- Autenticação e perfis de utilizador
- Exportação DIP individual

## Ainda a validar

- Exportação DIP na interface em casos limite
- Validação ciclica SIP → AIP → DIP → SIP
