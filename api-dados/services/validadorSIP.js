const fs = require('fs').promises;
const path = require('path');
const AdmZip = require('adm-zip');
const crypto = require('crypto');

const TIPOS_RECURSO = ['artigo', 'tese', 'slides', 'teste', 'relatorio', 'aplicacao', 'problema', 'outro'];
const VISIBILIDADES = ['publico', 'privado'];
const EXTENSOES_WHITELIST = ['.pdf', '.txt', '.docx', '.xlsx', '.jpg', '.png', '.gif', '.mp4', '.zip', '.pptx', '.md', '.html', '.csv'];
const TAMANHO_MAX_ZIP = 100 * 1024 * 1024; // 100MB
const TAMANHO_MAX_FICHEIRO = 50 * 1024 * 1024; // 50MB

// Valida estrutura, metadados, seguranca e consistencia do SIP
class ValidadorSIP {
    constructor() {
        this.erros = [];
        this.avisos = [];
        this.validacoes = {
            estrutura: { ok: false, detalhes: '' },
            metadados: { ok: false, detalhes: '' },
            seguranca: { ok: false, detalhes: '' },
            consistencia: { ok: false, detalhes: '' }
        };
        this.manifesto = null;
        this.ficheirosZip = [];
    }

    // Camada 1: Validação de Estrutura
    async validarEstrutura(caminhoZip) {
        try {
            // Verificar se ZIP existe
            const stats = await fs.stat(caminhoZip);
            if (stats.size > TAMANHO_MAX_ZIP) {
                this.erros.push({
                    categoria: 'estrutura',
                    mensagem: `Tamanho do ZIP excede 100MB (${(stats.size / 1024 / 1024).toFixed(1)}MB)`,
                    campo: 'file'
                });
                return false;
            }

            // Tentar descompactar e validar estrutura
            let zip;
            try {
                zip = new AdmZip(caminhoZip);
            } catch (err) {
                this.erros.push({
                    categoria: 'estrutura',
                    mensagem: 'ZIP corrompido ou inválido',
                    campo: 'file'
                });
                return false;
            }

            const ziprEntries = zip.getEntries();
            
            // Detectar se há pasta raiz única (problema comum ao comprimir uma pasta)
            let pastaRaiz = null;
            const todasAsPastas = ziprEntries.map(e => e.entryName).filter(nome => !nome.endsWith('/'));
            
            if (todasAsPastas.length > 0) {
                const primeiraNivel = todasAsPastas[0].split('/')[0];
                // Se todos os ficheiros começam com a mesma pasta
                if (todasAsPastas.every(nome => nome.startsWith(primeiraNivel + '/'))) {
                    pastaRaiz = primeiraNivel;
                    console.log(`Detectada pasta raiz: ${pastaRaiz}. Normalizando...`);
                }
            }

            // Normalizar nomes dos ficheiros removendo pasta raiz se existir
            this.ficheirosZip = ziprEntries.map(e => {
                let nome = e.entryName;
                if (pastaRaiz && nome.startsWith(pastaRaiz + '/')) {
                    nome = nome.substring(pastaRaiz.length + 1);
                }
                return {
                    nome: nome,
                    tamanho: e.header.size,
                    isDir: e.isDirectory,
                    entryOriginal: e.entryName
                };
            }).filter(e => !e.isDir || e.nome); // Filtrar pastas vazias

            // Verificar se existe manifest.json na raiz
            const temManifesto = this.ficheirosZip.some(e => e.nome === 'manifest.json');
            if (!temManifesto) {
                this.erros.push({
                    categoria: 'estrutura',
                    mensagem: 'Falta arquivo obrigatório: manifest.json na raiz do ZIP',
                    campo: 'manifest.json'
                });
                return false;
            }

            // Verificar se existe pasta data/
            const temData = this.ficheirosZip.some(e => e.nome.startsWith('data/'));
            if (!temData) {
                this.avisos.push('Pasta data/ vazia ou não encontrada');
            }

            // Ler e parsear manifest.json
            try {
                const manifestEntry = pastaRaiz 
                    ? zip.getEntry(`${pastaRaiz}/manifest.json`)
                    : zip.getEntry('manifest.json');
                const manifestContent = manifestEntry.getData().toString('utf8');
                this.manifesto = JSON.parse(manifestContent);
            } catch (err) {
                this.erros.push({
                    categoria: 'estrutura',
                    mensagem: `Erro ao ler manifest.json: ${err.message}`,
                    campo: 'manifest.json'
                });
                return false;
            }


            this.validacoes.estrutura.ok = true;
            this.validacoes.estrutura.detalhes = 'Estrutura ZIP válida';
            return true;
        } catch (err) {
            this.erros.push({
                categoria: 'estrutura',
                mensagem: `Erro na validação de estrutura: ${err.message}`,
                campo: 'file'
            });
            return false;
        }
    }

    // Camada 2: Validação de Metadados
    validarMetadados() {
        if (!this.manifesto) {
            this.validacoes.metadados.ok = false;
            this.validacoes.metadados.detalhes = 'Manifesto não carregado';
            return false;
        }

        const m = this.manifesto;

        // Campos obrigatórios
        if (!m.titulo || m.titulo.trim() === '') {
            this.erros.push({
                categoria: 'metadados',
                mensagem: "Campo 'titulo' é obrigatório",
                campo: 'titulo'
            });
        }

        if (!m.tipo || !TIPOS_RECURSO.includes(m.tipo)) {
            this.erros.push({
                categoria: 'metadados',
                mensagem: `Tipo '${m.tipo}' não reconhecido. Valores permitidos: ${TIPOS_RECURSO.join(', ')}`,
                campo: 'tipo'
            });
        }

        // Validar enums
        if (m.visibilidade && !VISIBILIDADES.includes(m.visibilidade)) {
            this.erros.push({
                categoria: 'metadados',
                mensagem: `Visibilidade '${m.visibilidade}' inválida. Use 'publico' ou 'privado'`,
                campo: 'visibilidade'
            });
        }

        // Validar datas ISO 8601
        if (m.dataCriacao && isNaN(Date.parse(m.dataCriacao))) {
            this.erros.push({
                categoria: 'metadados',
                mensagem: `Data de criação '${m.dataCriacao}' não é válida (ISO 8601 esperado)`,
                campo: 'dataCriacao'
            });
        }

        // Validar hashtags como array
        if (m.hashtags && !Array.isArray(m.hashtags)) {
            if (typeof m.hashtags === 'string') {
                // Converter de string para array
                m.hashtags = m.hashtags.split(',').map(h => h.trim()).filter(Boolean);
            } else {
                this.avisos.push('Campo hashtags não é um array, será ignorado');
                m.hashtags = [];
            }
        }

        // Validar files se existir
        if (!m.files || !Array.isArray(m.files)) {
            this.avisos.push('Campo files ausente ou não é array, será criado automaticamente');
            m.files = [];
        }

        // Validar descricao
        if (!m.descricao) {
            this.avisos.push('Campo descricao não fornecido');
        }

        // Validar subtitulo (optional)
        if (m.subtitulo && typeof m.subtitulo !== 'string') {
            this.avisos.push('Campo subtitulo ignorado (não é string)');
            m.subtitulo = undefined;
        }

        this.validacoes.metadados.ok = this.erros.filter(e => e.categoria === 'metadados').length === 0;
        this.validacoes.metadados.detalhes = this.validacoes.metadados.ok ? 'Metadados válidos' : 'Erros nos metadados';
        
        return this.validacoes.metadados.ok;
    }

    // Camada 3: Validação de Segurança
    validarSeguranca() {
        const errosSeguranca = [];

        // Verificar path traversal e extensões
        if (this.manifesto.files && Array.isArray(this.manifesto.files)) {
            for (const file of this.manifesto.files) {
                const nome = file.name;

                // Path traversal
                if (nome.includes('..') || nome.includes('/etc/') || path.isAbsolute(nome)) {
                    errosSeguranca.push({
                        categoria: 'seguranca',
                        mensagem: `Path potencialmente perigoso detectado: ${nome}`,
                        campo: 'files'
                    });
                }

                // Extensão whitelist
                const ext = path.extname(nome).toLowerCase();
                if (!EXTENSOES_WHITELIST.includes(ext)) {
                    errosSeguranca.push({
                        categoria: 'seguranca',
                        mensagem: `Extensão não permitida: ${ext}`,
                        campo: `files.${nome}`
                    });
                }

                // Tamanho do ficheiro
                if (file.size && file.size > TAMANHO_MAX_FICHEIRO) {
                    errosSeguranca.push({
                        categoria: 'seguranca',
                        mensagem: `Ficheiro ${nome} excede 50MB`,
                        campo: `files.${nome}`
                    });
                }
            }
        }

        // Verificar ficheiros reais no ZIP
        for (const zipFile of this.ficheirosZip) {
            if (zipFile.isDir) continue;
            if (zipFile.nome === 'manifest.json' || zipFile.nome === 'bagit.txt' || zipFile.nome === 'checksums.txt') continue;

            const ext = path.extname(zipFile.nome).toLowerCase();
            if (!EXTENSOES_WHITELIST.includes(ext)) {
                errosSeguranca.push({
                    categoria: 'seguranca',
                    mensagem: `Extensão do ficheiro não permitida: ${zipFile.nome} (${ext})`,
                    campo: 'files'
                });
            }

            if (zipFile.tamanho > TAMANHO_MAX_FICHEIRO) {
                errosSeguranca.push({
                    categoria: 'seguranca',
                    mensagem: `Ficheiro ${zipFile.nome} excede 50MB`,
                    campo: 'files'
                });
            }
        }

        this.erros.push(...errosSeguranca);
        this.validacoes.seguranca.ok = errosSeguranca.length === 0;
        this.validacoes.seguranca.detalhes = this.validacoes.seguranca.ok ? 'Segurança verificada' : 'Problemas de segurança detectados';

        return this.validacoes.seguranca.ok;
    }

    // Camada 4: Validação de Consistência
    validarConsistencia() {
        const errosConsistencia = [];

        // Ficheiros em data/ devem estar em manifest.files
        const ficheirosManifesto = (this.manifesto.files || []).map(f => 'data/' + f.name);
        const ficheirosData = this.ficheirosZip
            .filter(f => f.nome.startsWith('data/') && !f.isDir)
            .map(f => f.nome);

        // Ficheiros orfãos (em data/ mas não em manifesto)
        for (const ficheiro of ficheirosData) {
            if (!ficheirosManifesto.includes(ficheiro)) {
                this.avisos.push(`Ficheiro órfão detectado: ${ficheiro} (não está em manifest.files)`);
            }
        }

        // Ficheiros faltando (em manifesto mas não em data/)
        for (const ficheiro of ficheirosManifesto) {
            const existe = this.ficheirosZip.some(f => f.nome === ficheiro && !f.isDir);
            if (!existe) {
                errosConsistencia.push({
                    categoria: 'consistencia',
                    mensagem: `Ficheiro declarado no manifesto não existe: ${ficheiro}`,
                    campo: 'files'
                });
            }
        }

        // Validar checksums (se fornecidos)
        if (this.manifesto.checksums && Array.isArray(this.manifesto.checksums)) {
            for (const check of this.manifesto.checksums) {
                const ficheiro = ficheirosData.find(f => f === 'data/' + check.name);
                if (!ficheiro) {
                    this.avisos.push(`Checksum para ficheiro inexistente: ${check.name}`);
                }
            }
        }

        // Validar tamanhos (se fornecidos)
        for (const file of (this.manifesto.files || [])) {
            const zipFile = this.ficheirosZip.find(f => f.nome === 'data/' + file.name);
            if (zipFile && file.size && zipFile.tamanho !== file.size) {
                this.avisos.push(`Tamanho do ficheiro ${file.name} difere no manifesto (declarado: ${file.size}, real: ${zipFile.tamanho})`);
            }
        }

        this.erros.push(...errosConsistencia);
        this.validacoes.consistencia.ok = errosConsistencia.length === 0;
        this.validacoes.consistencia.detalhes = this.validacoes.consistencia.ok ? 'Consistência verificada' : 'Problemas de consistência detectados';

        return this.validacoes.consistencia.ok;
    }

    // Executar todas as validações
    async validarCompleto(caminhoZip) {
        // Camada 1: Estrutura
        const estruturaOk = await this.validarEstrutura(caminhoZip);
        if (!estruturaOk) {
            return this.obterResultado();
        }

        // Camada 2: Metadados
        this.validarMetadados();

        // Camada 3: Segurança
        this.validarSeguranca();

        // Camada 4: Consistência
        this.validarConsistencia();

        return this.obterResultado();
    }

    obterResultado() {
        const todasOk = Object.values(this.validacoes).every(v => v.ok);

        return {
            ok: todasOk,
            validacoes: this.validacoes,
            relatorio: {
                dataValidacao: new Date(),
                erros: this.erros,
                avisos: this.avisos
            },
            manifesto: this.manifesto || {}
        };
    }

    // Calcular checksum do ZIP original
    async calcularChecksumZip(caminhoZip) {
        const conteudo = await fs.readFile(caminhoZip);
        return crypto.createHash('sha256').update(conteudo).digest('hex');
    }
}

module.exports = ValidadorSIP;
