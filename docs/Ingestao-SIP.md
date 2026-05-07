# Ingestão SIP

## Conceitos Fundamentais

### SIP, DIP e AIP — O que são

Estes conceitos vêm do OAIS (Open Archival Information System), um modelo de referência para preservação digital:

- **SIP (Submission Information Package)**: o que o produtor *submete* para o sistema. É o ZIP com manifesto e ficheiros que carrega. Pode estar desorganizado, com erros ou metadados incompletos.

- **AIP (Archival Information Package)**: o que o sistema *armazena* internamente após validação e normalização. É a versão "canónica" (limpa, validada, com checksums, etc.). Garante preservação de longo prazo.

- **DIP (Dissemination Information Package)**: o que o sistema *disponibiliza* para download. Nesta fase inicial, estamos a seguir a simplificação do enunciado: `DIP = SIP` na prática, isto é, o pacote exportado mantém a mesma estrutura base do pacote submetido.

### Fluxo no Projeto

```
Produtor submete ZIP (SIP)
    ↓
Sistema valida estrutura, manifesto, metadados
    ↓
Se OK: transforma em AIP (guarda no storage, regista BD)
Se erro: devolve relatório
    ↓
Utilizador pode depois descarregar um DIP equivalente ao SIP
```

### Estado actual da ingestão no projeto

Neste momento, a parte **backend** da ingestão SIP está implementada:

- existe `POST /ingestao/sip`;
- existe validação em camadas;
- existe criação de `Recurso` e `AIP`;
- existem endpoints para listar AIPs e consultar relatórios de validação.

O que ainda não está fechado é sobretudo a **camada de interface** da ingestão e a integração completa com o ciclo inverso de exportação/importação do mesmo pacote.

---

## Estrutura do SIP (ZIP baseado em BagIt simplificado)

```
meu-recurso-2026.zip
├── manifest.json          # Metadados do recurso
├── bagit.txt             # Versão BagIt (opcional, marca conformidade)
├── data/
│   ├── file1.pdf         # Ficheiro principal
│   ├── file2.txt         # Suplementar
│   └── ...
└── checksums.txt         # (opcional) checksums SHA-256
```

### Conteúdo de `manifest.json`

```json
{
  "titulo": "Título do Recurso",
  "subtitulo": "Subtítulo opcional",
  "tipo": "artigo",
  "hashtags": ["web", "programacao"],
  "visibilidade": "publico",
  "dataCriacao": "2026-03-01",
  "descricao": "Descrição do recurso",
  "files": [
    {
      "name": "file1.pdf",
      "size": 2048000,
      "type": "application/pdf",
      "required": true
    },
    {
      "name": "file2.txt",
      "size": 5000,
      "type": "text/plain",
      "required": false
    }
  ]
}
```

---

## Validações em Camadas

### Camada 1: Estrutura

- ZIP é válido e não corrompido
- Tem `manifest.json` na raiz
- Pasta `data/` existe
- Ficheiros listados no manifesto existem em `data/`
- Não há ficheiros em `data/` que não estejam listados no manifesto (alertar)

### Camada 2: Metadados

- `titulo` e `tipo` obrigatórios
- `tipo` está na enumeração permitida: `artigo`, `tese`, `slides`, `teste`, `relatorio`, `aplicacao`, `problema`, `outro`
- `visibilidade` é `publico` ou `privado` (valor por defeito: `publico`)
- Campos de data são válidos (ISO 8601)
- `hashtags` é um array (converter string separada por vírgulas se necessário)

### Camada 3: Segurança

- Ficheiros não contêm paths suspeitosos (ex: `../`, `/etc/`, absolute paths)
- Extensões são whitelisted: `.pdf`, `.txt`, `.docx`, `.xlsx`, `.jpg`, `.png`, `.gif`, `.mp4`, `.zip`
- Tamanho total do ZIP < 100MB
- Cada ficheiro < 50MB
- Nome de ficheiros válidos (sem caracteres especiais perigosos)

### Camada 4: Consistência

- Lista de ficheiros em `manifest.json` coincide com `data/` (sem ficheiros órfãos)
- Checksums (se fornecidos) validam os ficheiros
- Tamanhos declarados no manifesto coincidem com tamanhos reais

---

## Endpoint da API

### POST /ingestao/sip

**Request:**
```
POST /ingestao/sip
Content-Type: multipart/form-data
Authorization: Bearer <token>

Body:
  - file: <ZIP file>
```

**Response (201 - Sucesso):**
```json
{
  "status": "ok",
  "aipId": "AIP-2026-00001",
  "recursoId": "507f1f77bcf86cd799439011",
  "mensagem": "SIP ingerido com sucesso",
  "storageLocal": "/uploads/recursos/507f1f77bcf86cd799439011/"
}
```

**Response (400 - Erro de Validação):**
```json
{
  "status": "erro",
  "categoria": "metadados",
  "erros": [
    "Campo 'titulo' é obrigatório",
    "Tipo 'artigo_avulso' não reconhecido",
    "Ficheiro 'dados.pdf' declarado no manifesto não existe em data/"
  ],
  "validacoes": {
    "estrutura": { "ok": true },
    "metadados": { "ok": false, "detalhes": "..." },
    "seguranca": { "ok": true },
    "consistencia": { "ok": false, "detalhes": "..." }
  },
  "relatorio": {
    "dataValidacao": "2026-05-03T14:30:00Z",
    "produtor": "utilizador123",
    "sipHash": "abc123def456"
  }
}
```

---

## Pipeline de Processamento

1. **Recebe** POST com ZIP
2. **Valida** se é ZIP válido (não corrompido)
3. **Extrai** para pasta temporária
4. **Lê** `manifest.json`
5. **Valida em camadas**:
   - Estrutura (ZIP bem formado)
   - Metadados (campos obrigatórios e tipos válidos)
   - Segurança (nomes, extensões, tamanhos)
   - Consistência (manifesto ↔ ficheiros reais)
6. **Se erro**:
   - Deleta pasta temporária
   - Devolve relatório com erros categorizados
7. **Se OK**:
   - Cria `Recurso` na BD com os metadados
   - Move ficheiros para storage permanente: `/uploads/recursos/{recursoId}/data/`
   - Cria entrada `AIP` para rastreabilidade
   - Limpa pasta temporária
   - Devolve sucesso com IDs

---

## Estrutura de Ficheiros no Projeto

```
api-dados/
├── controllers/
│   ├── recursosController.js       (existente)
│   └── ingestaoController.js       (novo para SIP)
├── models/
│   ├── recurso.js                  (existente)
│   ├── post.js                     (existente)
│   └── aip.js                      (novo, rastreabilidade)
├── services/
│   ├── validadorSIP.js             (novo)
│   └── sIPProcessor.js             (novo)
├── routes/
│   ├── recursos.js                 (existente)
│   └── ingestao.js                 (novo)
├── middleware/
│   └── upload.js                   (usar/melhorar)
└── storage/                        (pasta para AIPs)
    └── recursos/
        └── {recursoId}/
            └── data/
```

---

## Modelo AIP (Rastreabilidade)

```javascript
// AIP Model
{
  _id: ObjectId,
  sipId: "SIP-2026-00001",                    // ID único do SIP ingerido
  recursoId: ObjectId,                        // Referência ao recurso criado
  status: "ok",                               // "ok" ou "erro"
  dataIngestao: Date,
  produtor: ObjectId,                         // Quem submete
  manifesto: { ... },                         // Cópia do manifest.json original
  validacoes: {
    estrutura: { ok: true },
    metadados: { ok: true },
    seguranca: { ok: true },
    consistencia: { ok: true }
  },
  storageLocal: "/uploads/recursos/{recursoId}/",
  relatorio: {
    dataValidacao: Date,
    erros: [],
    avisos: []
  },
  checksumSIP: "abc123...",                   // Hash do ZIP original
  downloadCount: 0                             // Rastreabilidade de uso
}
```

---

## Estado de Implementação

### Fase 4.1: Validador SIP

- [x] Verificar integridade do ZIP
- [x] Extrair e ler `manifest.json`
- [x] Validar em camadas (estrutura, metadados, segurança, consistência)
- [x] Gerar relatório de erros categorizados

### Fase 4.2: Processador SIP → AIP

- [x] Criar `Recurso` na BD a partir do manifesto
- [x] Mover ficheiros para storage permanente
- [x] Registar `AIP` na BD
- [x] Limpar temporários

### Fase 4.3: Endpoint da API

- [x] `POST /ingestao/sip` com multipart form
- [x] Autenticação obrigatória
- [x] Resposta padronizada (sucesso/erro)
- [x] `GET /ingestao/aips` para listar AIPs do utilizador
- [x] `GET /ingestao/aips/:sipId` para detalhe
- [x] `GET /ingestao/aips/:sipId/relatorio` para relatório de validação

### Fase 4.4: Interface (opcional para Fase 4)

- [ ] Formulário de submissão de ZIP
- [ ] Historial de AIPs por utilizador
- [ ] Consulta visual do relatório de validação de um AIP
- [ ] Integração do fluxo SIP na navegação principal

### Fase 4.5: Fecho do ciclo OAIS

- [ ] Garantir que um pacote exportado pode voltar a ser importado pela mesma estrutura
- [ ] Definir um modo de exportação compatível com re-ingestão completa
- [ ] Ligar ingestão SIP e disseminação DIP num fluxo demonstrável de ponta a ponta

---

## Melhorias Futuras

- Suporte a BagIt completo (checksums obrigatórios, validação automática)
- Versionamento de AIP (histórico de edições)
- Conversão para DIP com transformações (ex: PDF → TXT preview)
- Notificações automáticas ao produtor (sucesso/erro via email)
- Relatório em PDF para documento de decisão
- Integração com sistema de preservação digital externo
- Auditoria completa de acessos aos AIPs

---

## Resultado Esperado no Fim da Fase 4

✓ Produtores podem submeter ZIPs estruturados (SIPs)  
✓ Sistema valida e transforma automaticamente em AIPs  
✓ Recursos criados automaticamente na BD a partir do manifesto  
✓ Relatório claro em caso de erro  
✓ Ficheiros guardados no storage com rastreabilidade  
✓ Sistema deixa de aceitar apenas recursos avulsos e passa a aceitar submissões estruturadas
