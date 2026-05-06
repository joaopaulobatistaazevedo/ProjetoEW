# Disseminação — DIP (Dissemination Information Package)

## Conceitos Fundamentais

### DIP no Contexto OAIS

Enquanto o **SIP** é o que entra no sistema (submissão do produtor), o **DIP** é o que sai (disponibilização para o utilizador). É o último passo do ciclo OAIS:

```
Ingesta (SIP) → Armazenamento (AIP) → Disseminação (DIP) → Utilizador
```

O OAIS define o DIP como um pacote de informação criado específicamente para responder a um pedido de um utilizador/consumidor. Contém:

- **Conteúdo**: ficheiros do recurso (sujeitos às restrições de visibilidade)
- **Metadados**: informações descritivas do recurso
- **Manifesto**: lista de tudo o que está incluído no DIP
- **Rastreabilidade**: informações sobre a extracção (data, versão, filtros aplicados)

### Equivalência Prática: DIP ≈ SIP (Versão 1)

Na primeira versão deste sistema, **o DIP será estruturalmente idêntico ao SIP**, mas com diferenças importantes:

| Aspecto | SIP | DIP |
|--------|-----|-----|
| **Origem** | Produtor submete | Sistema extrai |
| **Validação** | Rigorosa (rejeita se erro) | Não aplicável (já validado) |
| **Metadados** | Submissão original | Enriquecidos (IDs gerados, checksums, datas) |
| **Ficheiros** | Os que o produtor incluiu | Apenas os que a visibilidade permite |
| **Manifesto** | Simples (entrada) | Completo (saída + rastreabilidade) |
| **Checksums** | Opcionais | Sempre presentes |
| **Uso** | Ingestão | Re-ingestão ou preservação |

**Nota**: Numa fase 2, o DIP poderia ser diferente (ex: HTML, PDF, formatos de exposição). Por enquanto, mantemos equivalência para permitir re-ciclos.

### Flexibilidade do DIP face ao SIP

No contexto do modelo OAIS, o DIP nao tem obrigatoriamente de ser igual ao SIP, nem tem de incluir todos os elementos originalmente submetidos. O DIP representa apenas a versao dos dados disponibilizada ao utilizador final no processo de disseminacao, podendo ser uma selecao parcial ou uma transformacao do conteudo preservado no AIP.

Assim, o sistema deve permitir a extracao seletiva de conteudos a partir do AIP, possibilitando, por exemplo, a entrega de apenas um ficheiro individual pertencente ao SIP original, em vez do pacote completo. Desta forma, o DIP pode conter:

- um unico ficheiro,
- um subconjunto dos ficheiros originais,
- ou uma versao transformada dos mesmos,

dependendo do pedido do utilizador.

Esta abordagem garante flexibilidade no acesso a informacao preservada, sem comprometer a integridade do AIP.

---

## Estrutura do DIP (ZIP com Metadados Enriquecidos)

```
recurso-disseminado-2026.zip
├── manifest.json           # Metadados + rastreabilidade
├── bagit.txt              # Marca conformidade OAIS
├── data/
│   ├── file1.pdf          # Ficheiros acessíveis pela visibilidade
│   ├── file2.txt
│   └── ...
├── checksums.txt          # SHA-256 de todos os ficheiros
└── disseminacao.log       # Log da extracção (metadados)
```

### Conteúdo de `manifest.json` (DIP)

```json
{
  "tipo_pacote": "DIP",
  "versao_dip": "1.0",
  "aipId": "AIP-2026-00001",
  "recursoId": "507f1f77bcf86cd799439011",
  
  "metadados_originais": {
    "titulo": "Título do Recurso",
    "subtitulo": "Subtítulo opcional",
    "tipo": "artigo",
    "hashtags": ["web", "programacao"],
    "visibilidade": "publico",
    "dataCriacao": "2026-03-01",
    "descricao": "Descrição do recurso"
  },
  
  "metadados_enriquecidos": {
    "dataIngestao": "2026-04-15T10:30:00Z",
    "dataExportacao": "2026-05-03T14:25:00Z",
    "produtorId": "utilizador123",
    "exportadoPor": "utilizador456",
    "versionAIP": "1",
    "estadoArmazenamento": "ativo"
  },
  
  "ficheiros": [
    {
      "name": "file1.pdf",
      "size": 2048000,
      "type": "application/pdf",
      "required": true,
      "checksum_sha256": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      "incluido_no_dip": true,
      "motivo_exclusao": null
    },
    {
      "name": "file2.txt",
      "size": 5000,
      "type": "text/plain",
      "required": false,
      "checksum_sha256": "5d41402abc4b2a76b9719d911017c592",
      "incluido_no_dip": true,
      "motivo_exclusao": null
    },
    {
      "name": "anexo_restrito.pdf",
      "size": 1500000,
      "type": "application/pdf",
      "required": false,
      "checksum_sha256": "abc123...",
      "incluido_no_dip": false,
      "motivo_exclusao": "visibilidade: privado"
    }
  ],
  
  "politica_visibilidade_aplicada": {
    "usuario": "utilizador456",
    "nivel_acesso": "publico",
    "ficheiros_excluidos": 1,
    "ficheiros_incluidos": 2
  },
  
  "validacao": {
    "estrutura_valida": true,
    "checksums_validados": true,
    "integridade_confirmada": true
  }
}
```

### Conteúdo de `disseminacao.log`

```
=== LOG DE DISSEMINAÇÃO ===
Data: 2026-05-03T14:25:00Z
AIP ID: AIP-2026-00001
Recurso ID: 507f1f77bcf86cd799439011

--- SOLICITANTE ---
Utilizador: utilizador456
Autenticação: JWT válido
Permissão: acesso de leitura confirmado

--- FILTROS APLICADOS ---
Política de visibilidade: "publico"
Ficheiros públicos: 2
Ficheiros privados (excluídos): 1
Metadados sensíveis: 0 (removidos)

--- FICHEIROS EMPACOTADOS ---
✓ file1.pdf (2048 KB) - SHA256: e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
✓ file2.txt (5 KB) - SHA256: 5d41402abc4b2a76b9719d911017c592
✗ anexo_restrito.pdf (1500 KB) - Excluído por política de visibilidade

--- RESULTADO ---
Status: OK
Tamanho total do ZIP: 2053 KB
Checksum do DIP: f8e4c5a2b9d1e3f6a4c8b2d5e7f9a1c3
Tempo de processamento: 234 ms

=== FIM DO LOG ===
```

---

## Fluxo de Disseminação (DIP)

```
Utilizador faz pedido GET /recursos/{recursoId}/exportar
    ↓
Sistema valida autenticação (JWT)
    ↓
Sistema verifica permissões (pode este utilizador aceder?)
    ↓
Sistema carrega AIP da base de dados
    ↓
Sistema filtra ficheiros por política de visibilidade
    ↓
Sistema constrói DIP:
    - Copia metadados do AIP
    - Enriquece com dados de exportação
    - Filtra ficheiros (apenas públicos ou autorizados)
    - Calcula checksums
    - Cria manifesto completo
    - Cria log de disseminação
    ↓
Sistema gera ZIP com estrutura BagIt
    ↓
Sistema devolve ZIP para download
    ↓
(Opcional) Sistema regista no AIP que foi exportado
```

---

## Diferenças Chave entre SIP e DIP

### 1. **Origem e Direção**

| SIP | DIP |
|-----|-----|
| Fluxo de **entrada** (produtor → sistema) | Fluxo de **saída** (sistema → utilizador) |
| Submissão | Disponibilização |

### 2. **Validação e Processamento**

| SIP | DIP |
|-----|-----|
| Validações rigorosas (rejeita SIP inválido) | Sem validação (AIP já foi validado) |
| Transforma em AIP | Cria a partir do AIP |
| Pode conter erros (que são reportados) | Sempre válido (já passou filtros) |

### 3. **Contenção de Ficheiros**

| SIP | DIP |
|-----|-----|
| Todos os ficheiros que o produtor incluiu | Apenas os que a política de visibilidade permite |
| Pode incluir metadados privados | Remove metadados sensíveis se necessário |

### 4. **Metadados**

| SIP | DIP |
|-----|-----|
| Metadados originais do produtor | Metadados originais + enriquecidos |
| Sem checksums (opcionais) | Checksums obrigatórios (rastreabilidade) |
| Sem IDs de sistema | Inclui AIP ID, Recurso ID, versão |

### 5. **Rastreabilidade**

| SIP | DIP |
|-----|-----|
| Relatório de ingestão | Log de exportação |
| Quem submeteu | Quem descarregou, quando, que filtros foram aplicados |

### 6. **Estrutura (prática na v1)**

| SIP | DIP |
|-----|-----|
| BagIt simplificado (bagit.txt opcional) | BagIt completo (bagit.txt obrigatório) |
| Checksums opcionais | Checksums obrigatórios |
| Manifesto simples | Manifesto enriquecido |

---

## Políticas de Visibilidade na Exportação

### Regra Geral

```
SE recurso.visibilidade = "publico"
    ENTÃO todos os ficheiros público são incluídos no DIP
    E qualquer utilizador autenticado pode descarregar

SE recurso.visibilidade = "privado"
    ENTÃO apenas o produtor ou administrador pode exportar
    E o DIP inclui apenas metadados não-sensíveis
```

### Implementação Prática

```javascript
// Pseudo-código da verificação de permissão

function podeExportarRecurso(utilizadorId, recurso) {
  // Caso 1: Recurso público
  if (recurso.visibilidade === "publico") {
    return true; // Qualquer utilizador autenticado
  }
  
  // Caso 2: Recurso privado
  if (recurso.visibilidade === "privado") {
    return utilizadorId === recurso.produtorId || ehAdministrador(utilizadorId);
  }
  
  return false;
}

function construirDIP(aip, utilizadorId, filtros = {}) {
  const dip = {
    manifesto: {...aip.manifesto},
    ficheirosIncluidos: [],
    ficheirosExcluidos: []
  };
  
  for (const ficheiro of aip.ficheiros) {
    if (ficheiro.visibilidade === "privado" && !ehProdutor(utilizadorId, aip)) {
      dip.ficheirosExcluidos.push({
        nome: ficheiro.nome,
        motivo: "política de visibilidade: privado"
      });
    } else {
      dip.ficheirosIncluidos.push(ficheiro);
    }
  }
  
  return dip;
}
```

---

## Endpoints da API para Disseminação

### GET /recursos/{recursoId}/exportar

Inicia o processo de exportação e devolve o DIP como ZIP.

**Request:**
```
GET /recursos/507f1f77bcf86cd799439011/exportar
Authorization: Bearer <token>
```

**Query Parameters (opcionais):**
- `formato`: `zip` (default), `json`, `html` (para futuras versões)
- `incluir_metadados`: `true` (default) ou `false`
- `apenas_publica`: `true` para filtrar apenas recursos públicos

**Response (200 - Sucesso):**
```
Content-Type: application/zip
Content-Disposition: attachment; filename="recurso-2026-05-03.zip"

[Binary ZIP content]
```

**Response (403 - Sem Permissão):**
```json
{
  "status": "erro",
  "codigo": "acesso_negado",
  "mensagem": "Não tem permissão para exportar este recurso",
  "motivo": "recurso é privado e não é o produtor"
}
```

**Response (404 - Não Encontrado):**
```json
{
  "status": "erro",
  "codigo": "recurso_nao_encontrado",
  "mensagem": "Recurso com ID 507f1f77bcf86cd799439011 não existe"
}
```

---

### GET /recursos/exportar-multiplos

Exporta vários recursos numa única operação.

**Request:**
```
GET /recursos/exportar-multiplos?ids=507f,508a,509c
Authorization: Bearer <token>
```

**Response (200 - Sucesso):**
```
Content-Type: application/zip
Content-Disposition: attachment; filename="recursos-lote-2026-05-03.zip"

[ZIP com múltiplos DIPs, cada um numa pasta]
```

**Estrutura no ZIP:**
```
recursos-lote.zip
├── recurso-507f1f77bcf86cd799439011/
│   ├── manifest.json
│   ├── bagit.txt
│   ├── data/
│   └── checksums.txt
├── recurso-508a8f88dce97de899540122/
│   ├── manifest.json
│   ├── bagit.txt
│   ├── data/
│   └── checksums.txt
└── lote-metadados.json
```

---

## Pipeline de Processamento (Implementação)

### Fase 1: Autenticação e Autorização

```javascript
// verificarPermissaoExportacao.js
async function verificarPermissaoExportacao(recursoId, utilizadorId, token) {
  // 1. Valida JWT
  const usuario = verificarToken(token);
  if (!usuario) throw new Error("Token inválido");
  
  // 2. Carrega recurso da BD
  const recurso = await Recurso.findById(recursoId);
  if (!recurso) throw new Error("Recurso não encontrado");
  
  // 3. Verifica política de visibilidade
  if (recurso.visibilidade === "publico") {
    return true;
  } else if (recurso.visibilidade === "privado") {
    return recurso.produtorId === usuario.id || usuario.papel === "admin";
  }
  
  return false;
}
```

### Fase 2: Construção do DIP

```javascript
// disseminacaoService.js
async function construirDIP(aip, utilizadorId, opcoes = {}) {
  // 1. Filtra ficheiros por visibilidade
  const ficheirosIncluidos = aip.ficheiros.filter(f => {
    return f.visibilidade === "publico" || 
           f.propriedadeRestritaA === utilizadorId;
  });
  
  // 2. Prepara manifesto enriquecido
  const manifesto = {
    tipo_pacote: "DIP",
    versao_dip: "1.0",
    aipId: aip.id,
    recursoId: aip.recursoId,
    metadados_originais: aip.metadados,
    metadados_enriquecidos: {
      dataIngestao: aip.dataIngestao,
      dataExportacao: new Date().toISOString(),
      exportadoPor: utilizadorId,
      versionAIP: aip.versao
    },
    ficheiros: ficheirosIncluidos.map(f => ({
      name: f.nome,
      size: f.tamanho,
      type: f.mimetype,
      checksum_sha256: f.checksum
    }))
  };
  
  // 3. Calcula checksums se não existirem
  for (const ficheiro of ficheirosIncluidos) {
    if (!ficheiro.checksum) {
      ficheiro.checksum = await calcularChecksum(ficheiro.caminho);
    }
  }
  
  return { manifesto, ficheirosIncluidos };
}
```

### Fase 3: Geração do ZIP

```javascript
// zipGenerator.js
async function gerarDIPZip(dip, recursoId) {
  const zip = new JSZip();
  
  // 1. Adiciona manifesto
  zip.file("manifest.json", JSON.stringify(dip.manifesto, null, 2));
  
  // 2. Adiciona bagit.txt
  zip.file("bagit.txt", "BagIt-Version: 1.0\nTag-File-Character-Encoding: UTF-8");
  
  // 3. Adiciona ficheiros
  const dataFolder = zip.folder("data");
  for (const ficheiro of dip.ficheirosIncluidos) {
    const conteudo = fs.readFileSync(ficheiro.caminho);
    dataFolder.file(ficheiro.nome, conteudo);
  }
  
  // 4. Gera checksums.txt
  let checksumContent = "";
  for (const ficheiro of dip.ficheirosIncluidos) {
    checksumContent += `${ficheiro.checksum}  data/${ficheiro.nome}\n`;
  }
  zip.file("checksums.txt", checksumContent);
  
  // 5. Cria log de disseminação
  const log = gerarLogDisseminacao(dip, recursoId);
  zip.file("disseminacao.log", log);
  
  // 6. Gera o ZIP final
  return await zip.generateAsync({ type: "nodebuffer" });
}
```

### Fase 4: Endpoint da API

```javascript
// routes/disseminacao.js
router.get("/recursos/:recursoId/exportar", async (req, res) => {
  try {
    const { recursoId } = req.params;
    const usuario = req.usuario; // Do middleware de autenticação
    
    // 1. Verifica permissão
    const temPermissao = await verificarPermissaoExportacao(
      recursoId, 
      usuario.id, 
      req.headers.authorization
    );
    
    if (!temPermissao) {
      return res.status(403).json({
        status: "erro",
        codigo: "acesso_negado",
        mensagem: "Não tem permissão para exportar este recurso"
      });
    }
    
    // 2. Carrega AIP
    const aip = await AIP.findOne({ recursoId });
    if (!aip) {
      return res.status(404).json({
        status: "erro",
        codigo: "recurso_nao_encontrado"
      });
    }
    
    // 3. Constrói DIP
    const dip = await construirDIP(aip, usuario.id);
    
    // 4. Gera ZIP
    const zipBuffer = await gerarDIPZip(dip, recursoId);
    
    // 5. Regista exportação (auditoria)
    await registarExportacao(recursoId, usuario.id, new Date());
    
    // 6. Devolve ZIP
    res.setHeader("Content-Type", "application/zip");
    res.setHeader(
      "Content-Disposition", 
      `attachment; filename="recurso-${recursoId}-${Date.now()}.zip"`
    );
    res.send(zipBuffer);
    
  } catch (erro) {
    console.error("Erro na exportação:", erro);
    res.status(500).json({
      status: "erro",
      mensagem: "Erro ao exportar recurso"
    });
  }
});
```

---

## Re-ingestão: DIP → SIP

Uma das vantagens de manter o DIP estruturalmente similar ao SIP é permitir re-ciclos. Um DIP exportado pode ser re-ingerido como novo SIP:

```
1. Utilizador descarrega DIP como ZIP
2. Utilizador faz pequenas alterações (ex: adiciona ficheiro, muda título)
3. Utilizador submete o ZIP modificado como novo SIP
4. Sistema valida e cria novo AIP
5. Sistema permite versioning ou cria recurso derivado
```

### Mecanismo de Versioning

```javascript
// Quando um DIP é re-ingerido:
async function re_ingerirDIP(zipfile, sipOrigem) {
  const novoAIP = await processarSIP(zipfile);
  
  // Opção 1: Criar nova versão do mesmo recurso
  if (novoAIP.recursoId === sipOrigem.recursoId) {
    novoAIP.versao = sipOrigem.versao + 1;
    novoAIP.recursoDerivado = sipOrigem.aipId;
  }
  
  // Opção 2: Criar recurso novo (por defeito)
  else {
    novoAIP.recursoDerivado = sipOrigem.aipId;
    novoAIP.versao = 1;
  }
  
  return novoAIP;
}
```

---

## Estrutura de Ficheiros (Actualização no Projeto)

```
api-dados/
├── controllers/
│   ├── recursosController.js           (existente)
│   ├── ingestaoController.js           (existente, para SIP)
│   └── disseminacaoController.js       (novo, para DIP)
├── models/
│   ├── recurso.js                      (existente)
│   ├── aip.js                          (existente)
│   ├── exportacao.js                   (novo, auditoria)
│   └── dip.js                          (novo, se necessária reificação)
├── services/
│   ├── validadorSIP.js                 (existente)
│   ├── sIPProcessor.js                 (existente)
│   ├── disseminacaoService.js          (novo)
│   ├── zipGenerator.js                 (novo)
│   └── verificacaoPermissoes.js        (novo)
├── routes/
│   ├── recursos.js                     (existente)
│   ├── ingestao.js                     (existente)
│   └── disseminacao.js                 (novo)
├── middleware/
│   ├── autenticacao.js                 (existente)
│   └── verificarPermissaoExportacao.js (novo)
└── storage/
    ├── uploads/recursos/               (AIPs)
    └── exports/                        (DIPs temporários antes de zip)
```

---

## Checklist de Implementação (Fase 5)

- [ ] **Modelo DIP**: Criar schema `Exportacao` para auditoria
- [ ] **Verificação de Permissões**: Implementar `verificarPermissaoExportacao()`
- [ ] **Construção de DIP**: Implementar `construirDIP()` com filtros de visibilidade
- [ ] **Geração de ZIP**: Implementar `gerarDIPZip()` com BagIt completo
- [ ] **Endpoint GET /recursos/{id}/exportar**: Handler completo
- [ ] **Endpoint GET /recursos/exportar-multiplos**: Para lotes
- [ ] **Logs de Auditoría**: Registar quem exportou, quando, o quê
- [ ] **Testes Unitários**: Validar filtros de visibilidade
- [ ] **Testes de Integração**: SIP → AIP → DIP → download
- [ ] **Documentação de API**: Swagger para endpoints de disseminação
- [ ] **Re-ingestão**: Permitir que DIP possa ser novo SIP

---

## Evolução para v2: Estruturas Alternativas de DIP

Na versão 1, mantemos **DIP ≈ SIP** por simplicidade. Porém, uma segunda versão poderia diversificar o DIP para diferentes cenários de consumo. Discutimos as opções:

### Opção A: Manter DIP = SIP (Status Quo)

**Estrutura:**
```
recurso-2026.zip
├── manifest.json
├── bagit.txt
├── data/
└── checksums.txt
```

**Vantagens:**
- ✅ Simplicidade máxima
- ✅ Re-ingestão trivial (DIP é novo SIP)
- ✅ Sem mudanças no pipeline
- ✅ Compatibilidade com ferramentas BagIt padrão

**Desvantagens:**
- ❌ Não otimizado para diferentes tipos de consumo
- ❌ Ficheiros grandes no ZIP (não é exposição web)
- ❌ Sem diferenciação entre arquivamento e disseminação

**Recomendação**: Para **longo prazo** (>2 anos) ou se o sistema é puramente arquivo.

---

### Opção B: Múltiplos Formatos DIP (Recomendado para v2)

O sistema ofereceria **múltiplos formatos de DIP**, permitindo que o utilizador escolha na exportação:

```
GET /recursos/{recursoId}/exportar?formato=zip
GET /recursos/{recursoId}/exportar?formato=json
GET /recursos/{recursoId}/exportar?formato=html
GET /recursos/{recursoId}/exportar?formato=pdf
```

#### B1: DIP-ZIP (arquival, idêntico a v1)

```
recurso-2026.zip
├── manifest.json
├── bagit.txt
├── data/
└── checksums.txt
```

**Uso**: Preservação, arquivo, re-ingestão

---

#### B2: DIP-JSON (API-first)

Metadados + referências aos ficheiros (streaming ou links):

```json
{
  "tipo_pacote": "DIP",
  "formato": "json",
  "versao_dip": "2.0",
  "aipId": "AIP-2026-00001",
  "recursoId": "507f1f77bcf86cd799439011",
  
  "metadados": {
    "titulo": "Título do Recurso",
    "tipo": "artigo",
    "hashtags": ["web", "programacao"],
    "dataIngestao": "2026-04-15T10:30:00Z",
    "dataExportacao": "2026-05-03T14:25:00Z"
  },
  
  "ficheiros": [
    {
      "id": "file-1",
      "nome": "file1.pdf",
      "mimetype": "application/pdf",
      "tamanho": 2048000,
      "url_download": "https://api.exemplo.pt/download/file-1",
      "checksum_sha256": "e3b0c44298fc1c149..."
    },
    {
      "id": "file-2",
      "nome": "file2.txt",
      "mimetype": "text/plain",
      "tamanho": 5000,
      "url_download": "https://api.exemplo.pt/download/file-2",
      "checksum_sha256": "5d41402abc4b2a..."
    }
  ],
  
  "_links": {
    "self": {
      "href": "https://api.exemplo.pt/recursos/507f1f77bcf86cd799439011/exportar?formato=json"
    },
    "files": {
      "href": "https://api.exemplo.pt/recursos/507f1f77bcf86cd799439011/ficheiros"
    }
  }
}
```

**Uso**: Integração com sistemas terceiros, APIs, aplicações web

---

#### B3: DIP-HTML (exposição web)

Página HTML autocontida com metadados e links de download:

```
recurso-2026.html
```

Conteúdo HTML:
```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Recurso: Título do Recurso</title>
  <style>
    /* Bootstrap inline styles */
  </style>
</head>
<body>
  <div class="container">
    <h1>Título do Recurso</h1>
    <div class="metadata">
      <p><strong>Tipo:</strong> artigo</p>
      <p><strong>Data:</strong> 2026-03-01</p>
      <p><strong>Hashtags:</strong> web, programacao</p>
    </div>
    
    <h2>Ficheiros</h2>
    <ul>
      <li><a href="#download-file1">file1.pdf</a> (2 MB)</li>
      <li><a href="#download-file2">file2.txt</a> (5 KB)</li>
    </ul>
    
    <h2>Manifesto Técnico</h2>
    <pre id="manifest">
      { "metadados": { ... } }
    </pre>
  </div>
</body>
</html>
```

**Uso**: Partilha web, documentação, visualização rápida

---

#### B4: DIP-PDF (documento único)

Gera PDF com capa, metadados e índice de ficheiros (apenas para tipos suportados):

```
recurso-2026.pdf
├── [Página 1] Capa com metadados
├── [Página 2] Manifesto técnico
└── [Páginas 3+] Conteúdo dos ficheiros (PDFs integrados, texto renderizado)
```

**Uso**: Arquivos institucionais, conformidade legal, documentação impressa

**Limitação**: Aplicável apenas a artigos, teses em PDF/texto. Não para binários arbitrários.

---

### Opção C: DIP "Nativo" — Separação Completa de SIP

Uma versão mais radical: DIP deixa de ser um ZIP BagIt e passa a ser um **formato proprietário otimizado**:

```
recurso-2026-dip/
├── manifest.json       (sem bagit.txt, sem checksums.txt)
├── content.json        (índice de ficheiros e links)
├── metadata.json       (metadados enriquecidos)
└── audit.json          (apenas log de exportação, sem rastreabilidade SIP)
```

**Vantagens:**
- ✅ Versioning independente (DIP v2 ≠ SIP v1)
- ✅ Otimizado para consumo (sem dependências BagIt)
- ✅ Reduz tamanho (sem ficheiros redundantes)

**Desvantagens:**
- ❌ Re-ingestão complexa (DIP não é mais válido como SIP)
- ❌ Requires custom tools (sem conformidade com BagIt)
- ❌ Quebra ciclo OAIS fechado

**Recomendação**: ❌ **Não recomendado** — perde as vantagens de re-ciclo e conformidade OAIS.

---

### Opção D: Formatos Específicos por Tipo de Recurso

Diferentes estruturas dependendo de `recurso.tipo`:

| Tipo | Formato de DIP | Estrutura |
|------|---|---|
| `artigo`, `tese` | ZIP (BagIt) + PDF (opcional) | Documentação padrão |
| `aplicacao` | JSON + links | API-first |
| `dados`, `dataset` | CSV/JSON tabulado | Análise de dados |
| `multimédia` | Pasta com metadados + stream | Vídeo/áudio |

**Vantagens:**
- ✅ Otimizado por domínio
- ✅ Melhor UX para cada caso

**Desvantagens:**
- ❌ Complexidade extrema
- ❌ Difícil de manter

**Recomendação**: ⚠️ Considerar apenas em **v3+**, após consolidação de v2.

---

## Recomendação Final: Opção B (Múltiplos Formatos)

### Razão

A **Opção B** oferece o melhor compromisso entre:
- **Compatibilidade**: Mantém ZIP/BagIt (preservação clássica)
- **Flexibilidade**: Oferece JSON (APIs) e HTML (web)
- **Escalabilidade**: Fácil adicionar PDF ou outros formatos
- **Ciclo OAIS**: Mantém fechado (DIP-ZIP re-ingestível como SIP)

### Implementação em Fases

**v1 (Atual)**: 
- ✅ DIP-ZIP (BagIt, idêntico a SIP)

**v2 (Próxima)**:
- ✅ DIP-ZIP (mantém)
- ✅ DIP-JSON (novo, para APIs)
- ✅ DIP-HTML (novo, para exposição web)

**v3+ (Futuro)**:
- ✅ DIP-PDF (para arquivos institucionais)
- ✅ Formatos específicos por tipo

### Código para v2

```javascript
// routes/disseminacao.js (v2)
router.get("/recursos/:recursoId/exportar", async (req, res) => {
  const { formato = "zip" } = req.query;
  const recurso = await Recurso.findById(recursoId);
  
  const dip = await construirDIP(recurso, usuario.id);
  
  switch (formato) {
    case "zip":
      return disseminacaoService.exportarZIP(dip, res);
    case "json":
      return disseminacaoService.exportarJSON(dip, res);
    case "html":
      return disseminacaoService.exportarHTML(dip, res);
    case "pdf":
      return disseminacaoService.exportarPDF(dip, res);
    default:
      throw new Error("Formato desconhecido");
  }
});
```

### Estrutura de Ficheiros (v2)

```
api-dados/services/
├── disseminacaoService.js
├── formatadores/
│   ├── zipFormatter.js      (v1 → v2: manter)
│   ├── jsonFormatter.js     (novo)
│   ├── htmlFormatter.js     (novo)
│   └── pdfFormatter.js      (novo, fase 2)
└── (resto como v1)
```

---

## Conclusão

Para **manter estabilidade na v1**, recomenda-se:
- **Não mudar** DIP = SIP (ZIP BagIt)
- **Planear** evolução para múltiplos formatos em v2
- **Documentar** interface `IDIPFormatter` para extensibilidade

A estrutura em **Opção B** permite crescimento sem quebrar o ciclo OAIS ou forçar re-implementação do pipeline de ingestão.



| Pacote | Fase | Origem | Destino | Validação | Uso |
|--------|------|--------|---------|-----------|-----|
| **SIP** | Ingestão | Produtor | Sistema | Rigorosa | Submissão |
| **AIP** | Armazenamento | Sistema | Sistema | N/A | Preservação |
| **DIP** | Disseminação | Sistema | Utilizador | N/A | Download, re-ciclo |

Na **primeira versão**, DIP ≈ SIP estruturalmente, mas com:
- Metadados enriquecidos (IDs, datas, versão)
- Checksums obrigatórios
- Filtros de visibilidade aplicados
- Log de exportação para auditoria
- BagIt completo (validação de integridade)

Isto garante que o sistema fecha o ciclo OAIS (Ingesta → Armazenamento → Disseminação) mantendo a equivalência prática necessária para demonstração e re-cycling de recursos.
