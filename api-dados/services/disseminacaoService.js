const AIP = require('../models/aip');
const Recurso = require('../models/recurso');
const zipGenerator = require('./zipGenerator');
const Exportacao = require('../models/exportacao');
const JSZip = require('jszip');
const verificacaoPermissoes = require('./verificacaoPermissoes');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const EXTENSOES_TEXTO = new Set(['.txt', '.md', '.csv', '.json', '.xml', '.html', '.htm']);
const MIME_TEXTO = new Set(['application/json', 'application/xml']);

function criarErro(mensagem, statusCode = 500) {
    const erro = new Error(mensagem);
    erro.statusCode = statusCode;
    return erro;
}

function calcularChecksum(conteudo) {
    return crypto.createHash('sha256').update(conteudo).digest('hex');
}

function normalizarListaFicheiros(ficheirosSolicitados) {
    const lista = Array.isArray(ficheirosSolicitados)
        ? ficheirosSolicitados
        : typeof ficheirosSolicitados === 'string'
            ? ficheirosSolicitados.split(',')
            : [ficheirosSolicitados];

    return [...new Set(
        lista
            .filter(Boolean)
            .map(item => item.trim())
            .filter(Boolean)
    )];
}

function formatarTamanho(bytes = 0) {
    if (bytes >= 1024 * 1024) {
        return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
    }

    if (bytes >= 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${bytes} B`;
}

function sanitizarNomeArquivo(nome = '') {
    return String(nome)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._-]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase();
}

async function localizarFicheiroPreservado(baseDir, nomePedido) {
    const caminhoDireto = path.join(baseDir, nomePedido);

    try {
        await fs.access(caminhoDireto);
        return caminhoDireto;
    } catch (err) {
        // procurar recursivamente
    }

    const alvoNormalizado = nomePedido.replace(/\\/g, '/');
    const nomeBase = path.basename(nomePedido);
    const encontrados = [];

    async function percorrer(diretorioAtual, prefixoRelativo = '') {
        let entradas;
        try {
            entradas = await fs.readdir(diretorioAtual, { withFileTypes: true });
        } catch (err) {
            return;
        }

        for (const entrada of entradas) {
            const caminho = path.join(diretorioAtual, entrada.name);
            const relativo = path.posix.join(prefixoRelativo, entrada.name).replace(/\\/g, '/');

            if (entrada.isDirectory()) {
                await percorrer(caminho, relativo);
                continue;
            }

            if (relativo === alvoNormalizado || entrada.name === nomeBase) {
                encontrados.push(caminho);
            }
        }
    }

    await percorrer(baseDir);

    if (encontrados.length === 1) {
        return encontrados[0];
    }

    if (encontrados.length > 1) {
        throw criarErro(
            `Ficheiro preservado ambíguo no AIP: ${nomePedido}. Existem múltiplas cópias no armazenamento.`,
            500
        );
    }

    throw criarErro(`Ficheiro preservado não encontrado no AIP: ${nomePedido}`, 500);
}

async function obterConteudoDoSIPOriginal(aip, nomePedido) {
    const possiveisFontes = [
        path.join(aip.storageLocal || '', 'source', 'sip-original.zip'),
        path.join(aip.storageLocal || '', 'source', 'original.zip')
    ];

    for (const fonte of possiveisFontes) {
        try {
            await fs.access(fonte);
        } catch (err) {
            continue;
        }

        try {
            const zip = new (require('adm-zip'))(fonte);
            const entries = zip.getEntries();

            let pastaRaiz = '';
            const ficheiros = entries.filter(entry => !entry.isDirectory).map(entry => entry.entryName);
            if (ficheiros.length > 0) {
                const primeira = ficheiros[0].split('/')[0];
                if (ficheiros.every(nome => nome.startsWith(primeira + '/'))) {
                    pastaRaiz = primeira + '/';
                }
            }

            const nomesCandidatos = [
                `data/${nomePedido}`,
                `${pastaRaiz}data/${nomePedido}`,
                nomePedido,
                `${pastaRaiz}${nomePedido}`
            ].filter(Boolean);

            for (const candidato of nomesCandidatos) {
                const entry = zip.getEntry(candidato);
                if (entry && !entry.isDirectory) {
                    return entry.getData();
                }
            }
        } catch (err) {
            // ignorar e tentar a próxima fonte
        }
    }

    return null;
}

async function obterZipOriginalSIP(aip) {
    const possiveisFontes = [
        path.join(aip.storageLocal || '', 'source', 'sip-original.zip'),
        path.join(aip.storageLocal || '', 'source', 'original.zip')
    ];

    for (const fonte of possiveisFontes) {
        try {
            await fs.access(fonte);
            return await fs.readFile(fonte);
        } catch (err) {
            // tentar próxima fonte
        }
    }

    return null;
}

/**
 * Serviço: Disseminação (DIP)
 *
 * Implementa exportação seletiva a partir do AIP, permitindo:
 * - pacote completo;
 * - subconjunto de ficheiros;
 * - DIP com um único ficheiro;
 * - transformação simples para texto quando suportada.
 */
const disseminacaoService = {

    normalizarPedidoExportacao: function(opcoes = {}) {
        const ficheirosSolicitados = normalizarListaFicheiros(
            opcoes.ficheirosSolicitados || opcoes.ficheiro || opcoes.ficheiros
        );

        const transformacao = opcoes.transformacao === 'texto' ? 'texto' : 'original';

        return {
            ficheirosSolicitados,
            transformacao
        };
    },

    suportaTransformacaoTexto: function(ficheiro = {}) {
        const ext = path.extname(ficheiro.name || '').toLowerCase();
        const tipoMime = String(ficheiro.type || '').toLowerCase();

        return tipoMime.startsWith('text/')
            || MIME_TEXTO.has(tipoMime)
            || EXTENSOES_TEXTO.has(ext);
    },

    obterTipoPedido: function(totalDisponiveis, ficheirosSolicitados) {
        if (!ficheirosSolicitados || ficheirosSolicitados.length === 0 || ficheirosSolicitados.length >= totalDisponiveis) {
            return 'completo';
        }

        if (ficheirosSolicitados.length === 1) {
            return 'ficheiro-individual';
        }

        return 'subconjunto';
    },

    transformarBufferParaTexto: function(conteudo) {
        const textoNormalizado = conteudo
            .toString('utf8')
            .replace(/\r\n/g, '\n');

        return Buffer.from(textoNormalizado, 'utf8');
    },

    obterNomeTransformadoTexto: function(nomeOriginal) {
        return nomeOriginal.toLowerCase().endsWith('.txt')
            ? nomeOriginal
            : `${nomeOriginal}.txt`;
    },

    obterMetadadosBase: function(manifesto, visibilidade) {
        return {
            titulo: manifesto.titulo,
            subtitulo: manifesto.subtitulo,
            tipo: manifesto.tipo,
            hashtags: manifesto.hashtags || [],
            visibilidade,
            dataCriacao: manifesto.dataCriacao,
            descricao: manifesto.descricao
        };
    },

    carregarContextoRecurso: async function(recursoId) {
        //  Carregar versão mais recente do AIP (compatível com versionamento)
        const aip = await AIP.findOne({ recursoId: recursoId })
            .sort({ versao: -1 })  // Obter versão mais alta
            .populate('recursoId', 'titulo visibilidade autor');

        if (!aip) {
            throw criarErro(`AIP não encontrado para recurso ${recursoId}`, 404);
        }

        const recurso = await Recurso.findById(recursoId);
        if (!recurso) {
            throw criarErro(`Recurso ${recursoId} não encontrado`, 404);
        }

        return {
            aip,
            recurso,
            manifesto: aip.manifesto || {}
        };
    },

    // Método para extrair lista de ficheiros (apenas array novo)
    obterListaFicheiros: function(recurso, manifesto) {
        // Prioridade: usar array novo `ficheiros` se existir
        if (Array.isArray(recurso.ficheiros) && recurso.ficheiros.length > 0) {
            // Novo formato: array de ficheiros com metadados
            return recurso.ficheiros.map(f => ({
                name: f.nome,
                path: f.caminho,
                size: f.tamanho,
                type: f.tipo,
                checksum_sha256: f.checksum,
                versaoAIP: f.versaoAIP
            }));
        } else if (Array.isArray(manifesto.files) && manifesto.files.length > 0) {
            // Formato alternativo: ficheiros do manifesto
            return manifesto.files;
        }
        return [];
    },

    prepararFicheirosParaExportacao: async function(aip, ficheirosIncluidos, transformacao) {
        const pastaData = path.join(aip.storageLocal || '', 'data');
        const ficheirosPreparados = [];

        for (const ficheiro of ficheirosIncluidos) {
            let caminhoLocal = null;
            let conteudoOriginal = null;

            try {
                caminhoLocal = await localizarFicheiroPreservado(pastaData, ficheiro.name);
                conteudoOriginal = await fs.readFile(caminhoLocal);
            } catch (err) {
                conteudoOriginal = await obterConteudoDoSIPOriginal(aip, ficheiro.name);
                if (!conteudoOriginal) {
                    throw criarErro(`Ficheiro preservado não encontrado no AIP: ${ficheiro.name}`, 500);
                }
                caminhoLocal = null;
            }

            const checksumOriginal = ficheiro.checksum_sha256 && ficheiro.checksum_sha256 !== 'pendente'
                ? ficheiro.checksum_sha256
                : calcularChecksum(conteudoOriginal);

            const enriquecido = {
                ...ficheiro,
                caminhoLocal,
                nomeOriginal: ficheiro.name,
                nomeNoDIP: ficheiro.name,
                checksum_original_sha256: checksumOriginal,
                size_original: conteudoOriginal.length,
                tamanhoLegivel: formatarTamanho(conteudoOriginal.length),
                transformacao: 'original'
            };

            if (transformacao === 'texto') {
                if (!this.suportaTransformacaoTexto(ficheiro)) {
                    throw criarErro(`Transformação para texto não suportada em ${ficheiro.name}`, 400);
                }

                const conteudoTransformado = this.transformarBufferParaTexto(conteudoOriginal);
                enriquecido.conteudoBuffer = conteudoTransformado;
                enriquecido.nomeNoDIP = this.obterNomeTransformadoTexto(ficheiro.name);
                enriquecido.type = 'text/plain';
                enriquecido.size = conteudoTransformado.length;
                enriquecido.tamanhoLegivel = formatarTamanho(conteudoTransformado.length);
                enriquecido.checksum_sha256 = calcularChecksum(conteudoTransformado);
                enriquecido.transformacao = 'texto';
            } else {
                enriquecido.size = conteudoOriginal.length;
                enriquecido.checksum_sha256 = checksumOriginal;
                if (!caminhoLocal) {
                    enriquecido.conteudoBuffer = conteudoOriginal;
                }
            }

            ficheirosPreparados.push(enriquecido);
        }

        return ficheirosPreparados;
    },

    obterOpcoesExportacao: async function(recursoId, utilizadorId, papelUtilizador = 'consumidor') {
        const { aip, recurso } = await this.carregarContextoRecurso(recursoId);

        const filtro = await verificacaoPermissoes.filtrarFicheirosParaDIP(
            aip,
            utilizadorId,
            papelUtilizador
        );

        const ficheiros = (filtro.ficheirosIncluidos || []).map(ficheiro => ({
            name: ficheiro.name,
            size: ficheiro.size,
            type: ficheiro.type || 'application/octet-stream',
            required: !!ficheiro.required,
            tamanhoLegivel: formatarTamanho(ficheiro.size || 0),
            suportaTransformacaoTexto: this.suportaTransformacaoTexto(ficheiro)
        }));

        return {
            recursoId,
            aipId: aip._id.toString(),
            visibilidade: recurso.visibilidade,
            tiposPedidoSuportados: ['completo', 'subconjunto', 'ficheiro-individual'],
            transformacoesSuportadas: ['original', 'texto'],
            temTransformacaoTexto: ficheiros.some(ficheiro => ficheiro.suportaTransformacaoTexto),
            ficheiros
        };
    },

    /**
     * Exporta um recurso como DIP-ZIP
     * @param {string} recursoId - ID do recurso
     * @param {string} utilizadorId - ID do utilizador (para logs)
     * @param {string} papelUtilizador - 'produtor', 'consumidor', etc
     * @param {object} opcoes - seleção de ficheiros / transformação
     * @returns {Promise<{zipBuffer, metadata, dip}>}
     */
    exportarRecurso: async function(recursoId, utilizadorId, papelUtilizador = 'consumidor', opcoes = {}) {
        const tempoInicio = Date.now();

        try {
            const { aip, recurso, manifesto } = await this.carregarContextoRecurso(recursoId);
            const pedido = this.normalizarPedidoExportacao(opcoes);
            const ficheirosManifesto = Array.isArray(manifesto.files) ? manifesto.files : [];
            const nomesDisponiveis = new Set(ficheirosManifesto.map(ficheiro => ficheiro.name));
            const pedidoCompleto = pedido.ficheirosSolicitados.length === 0 || pedido.ficheirosSolicitados.length >= ficheirosManifesto.length;

            // Nesta fase do projeto, DIP = SIP. Se o ZIP original estiver preservado,
            // devolvemos exatamente o pacote ingerido.
            if (pedido.transformacao === 'original' && pedidoCompleto) {
                const zipOriginal = await obterZipOriginalSIP(aip);
                if (zipOriginal) {
                    const checksumZIP = calcularChecksum(zipOriginal);
                    const tempoProcessamento = Date.now() - tempoInicio;

                    const metadata = {
                        aipId: aip._id.toString(),
                        recursoId: recursoId,
                        titulo: recurso.titulo,
                        formato: 'zip',
                        tipoPedido: 'completo',
                        transformacao: 'original',
                        ficheirosSolicitados: [],
                        tamanhoZIP: zipOriginal.length,
                        checksumDIP: checksumZIP,
                        tempoProcessamento: tempoProcessamento,
                        ficheirosIncluidos: ficheirosManifesto.length,
                        ficheirosExcluidos: 0,
                        nomeArquivo: `${sanitizarNomeArquivo(recurso.titulo || manifesto.titulo || `recurso-${recursoId}`)}.zip`
                    };

                    console.log(
                        `✅ DIP exportado como SIP original: ${recursoId} ` +
                        `${(zipOriginal.length / 1024).toFixed(2)}KB em ${tempoProcessamento}ms`
                    );

                    return {
                        zipBuffer: zipOriginal,
                        metadata,
                        dip: {
                            aipId: aip._id.toString(),
                            pedido: {
                                tipo: 'completo',
                                transformacao: 'original',
                                ficheirosSolicitados: [],
                                totalDisponiveisNoAIP: ficheirosManifesto.length
                            },
                            metadados: this.obterMetadadosBase(manifesto, recurso.visibilidade),
                            metadados_enriquecidos: {
                                dataIngestao: aip.dataIngestao,
                                dataExportacao: new Date().toISOString(),
                                produtorId: aip.produtor,
                                exportadoPor: utilizadorId,
                                versionAIP: '1',
                                estadoArmazenamento: aip.status || 'ok',
                                visibilidade: recurso.visibilidade,
                                tipoPedido: 'completo',
                                transformacao: 'original'
                            },
                            ficheirosIncluidos: ficheirosManifesto,
                            ficheirosExcluidos: []
                        }
                    };
                }
            }

            const ficheirosInvalidos = pedido.ficheirosSolicitados.filter(nome => !nomesDisponiveis.has(nome));
            if (ficheirosInvalidos.length > 0) {
                throw criarErro(
                    `Ficheiros pedidos não encontrados no AIP: ${ficheirosInvalidos.join(', ')}`,
                    400
                );
            }

            const filtro = await verificacaoPermissoes.filtrarFicheirosParaDIP(
                aip,
                utilizadorId,
                papelUtilizador,
                pedido
            );

            if (!filtro.ficheirosIncluidos || filtro.ficheirosIncluidos.length === 0) {
                throw criarErro('O pedido DIP não inclui ficheiros disponíveis para exportação', 400);
            }

            const ficheirosNaoTransformaveis = pedido.transformacao === 'texto'
                ? filtro.ficheirosIncluidos.filter(ficheiro => !this.suportaTransformacaoTexto(ficheiro))
                : [];

            if (ficheirosNaoTransformaveis.length > 0) {
                throw criarErro(
                    `Transformação para texto indisponível para: ${ficheirosNaoTransformaveis.map(f => f.name).join(', ')}`,
                    400
                );
            }

            const ficheirosPreparados = await this.prepararFicheirosParaExportacao(
                aip,
                filtro.ficheirosIncluidos,
                pedido.transformacao
            );

            const tipoPedido = this.obterTipoPedido(
                ficheirosManifesto.length,
                pedido.ficheirosSolicitados
            );
            const visibilidade = recurso.visibilidade;
            const dataExportacao = new Date().toISOString();

            const dip = {
                aipId: aip._id.toString(),
                pedido: {
                    tipo: tipoPedido,
                    transformacao: pedido.transformacao,
                    ficheirosSolicitados: pedido.ficheirosSolicitados,
                    totalDisponiveisNoAIP: ficheirosManifesto.length
                },
                metadados: this.obterMetadadosBase(manifesto, visibilidade),
                metadados_enriquecidos: {
                    dataIngestao: aip.dataIngestao,
                    dataExportacao,
                    produtorId: aip.produtor,
                    exportadoPor: utilizadorId,
                    versionAIP: '1',
                    estadoArmazenamento: aip.status || 'ok',
                    visibilidade,
                    tipoPedido,
                    transformacao: pedido.transformacao
                },
                ficheirosIncluidos: ficheirosPreparados,
                ficheirosExcluidos: filtro.ficheirosExcluidos || []
            };

            const zipBuffer = await zipGenerator.gerarDIPZip(
                dip,
                aip._id.toString(),
                recursoId,
                utilizadorId
            );

            const checksumZIP = calcularChecksum(zipBuffer);
            const tempoProcessamento = Date.now() - tempoInicio;

            const metadata = {
                aipId: aip._id.toString(),
                recursoId: recursoId,
                titulo: recurso.titulo,
                formato: 'zip',
                tipoPedido,
                transformacao: pedido.transformacao,
                ficheirosSolicitados: pedido.ficheirosSolicitados,
                tamanhoZIP: zipBuffer.length,
                checksumDIP: checksumZIP,
                tempoProcessamento: tempoProcessamento,
                ficheirosIncluidos: dip.ficheirosIncluidos.length,
                ficheirosExcluidos: dip.ficheirosExcluidos.length,
                nomeArquivo: `${sanitizarNomeArquivo(recurso.titulo || manifesto.titulo || `recurso-${recursoId}`)}.zip`
            };

            console.log(
                `✅ DIP exportado: ${recursoId} (${tipoPedido}, ${pedido.transformacao}) ` +
                `${(zipBuffer.length / 1024).toFixed(2)}KB em ${tempoProcessamento}ms`
            );

            return {
                zipBuffer,
                metadata,
                dip
            };

        } catch (err) {
            console.error(`❌ Erro ao exportar recurso ${recursoId}:`, err.message);
            throw err;
        }
    },

    /**
     * Registar uma exportação na auditoria (melhor esforço)
     */
    registarExportacao: async function(aipId, recursoId, utilizadorId, metadata, req) {
        try {
            if (!Exportacao) return null;

            const exportacao = new Exportacao({
                aipId: aipId,
                recursoId: recursoId,
                exportadoPor: utilizadorId,
                dataExportacao: new Date(),
                formato: metadata.formato || 'zip',
                tamanhoZIP: metadata.tamanhoZIP,
                checksumDIP: metadata.checksumDIP,
                tempoProcessamento: metadata.tempoProcessamento,
                filtrosAplicados: {
                    ficheirosIncluidos: metadata.ficheirosIncluidos,
                    ficheirosExcluidos: metadata.ficheirosExcluidos,
                    ficheirosSolicitados: metadata.ficheirosSolicitados || [],
                    tipoPedido: metadata.tipoPedido || 'completo',
                    transformacao: metadata.transformacao || 'original'
                },
                status: 'sucesso',
                ipSolicitante: req && (req.ip || (req.connection && req.connection.remoteAddress)) || 'desconhecido',
                userAgent: req && req.get ? req.get('user-agent') : ''
            });

            await exportacao.save();
            return exportacao;
        } catch (err) {
            console.warn('Aviso: falha ao registar exportacao:', err.message);
            return null;
        }
    },

    /**
     * Exportar múltiplos recursos num único ZIP (lote)
     */
    exportarMultiplos: async function(recursoIds, utilizadorId, papelUtilizador) {
        try {
            const zipLote = new JSZip();
            const metadadosLote = {
                tipo_pacote: 'DIP_LOTE',
                versao: '1.0',
                dataExportacao: new Date().toISOString(),
                exportadoPor: utilizadorId,
                numeroRecursos: recursoIds.length,
                recursos: []
            };

            for (const recursoId of recursoIds) {
                try {
                    const { zipBuffer, metadata } = await this.exportarRecurso(
                        recursoId,
                        utilizadorId,
                        papelUtilizador
                    );

                    const zipItem = new JSZip();
                    await zipItem.loadAsync(zipBuffer);

                    for (const [nomeEntrada, dadosEntrada] of Object.entries(zipItem.files)) {
                        const novoNome = `recurso-${recursoId}/${nomeEntrada}`;
                        if (dadosEntrada.dir) {
                            zipLote.folder(novoNome);
                        } else {
                            const conteudo = await dadosEntrada.async('nodebuffer');
                            zipLote.file(novoNome, conteudo);
                        }
                    }

                    metadadosLote.recursos.push({
                        recursoId: recursoId,
                        aipId: metadata.aipId,
                        tamanho: metadata.tamanhoZIP,
                        checksum: metadata.checksumDIP
                    });

                } catch (err) {
                    console.warn(`Aviso: Recurso ${recursoId} não foi exportado: ${err.message}`);
                    metadadosLote.recursos.push({ recursoId: recursoId, erro: err.message });
                }
            }

            zipLote.file('lote-metadados.json', JSON.stringify(metadadosLote, null, 2));

            return zipLote.generateAsync({
                type: 'nodebuffer',
                compression: 'DEFLATE',
                compressionOptions: { level: 9 }
            });
        } catch (err) {
            throw err;
        }
    },

    /**
     * Exportar recurso com opções (modo: completo, subconjunto, individual)
     */
    exportarRecursoComOpcoes: async function(recursoId, utilizadorId, papelUtilizador, opcoes = {}) {
        try {
            // 1. Carregar contexto
            const contexto = await this.carregarContextoRecurso(recursoId);
            
            if (!contexto.aip) {
                const erro = new Error(`AIP não encontrado para recurso ${recursoId}`);
                erro.statusCode = 404;
                throw erro;
            }

            // 2. Verificar permissões
            const temPermissao = await verificacaoPermissoes.podeExportarRecurso(
                recursoId,
                utilizadorId,
                papelUtilizador
            );

            if (!temPermissao.temPermissao) {
                const erro = new Error('Sem permissão para exportar este recurso');
                erro.statusCode = 403;
                throw erro;
            }

            // 3. Filtrar ficheiros conforme modo
            const { ficheirosIncluidos, ficheirosExcluidos } = 
                await verificacaoPermissoes.filtrarFicheirosParaDIP(
                    contexto.aip,
                    utilizadorId,
                    papelUtilizador,
                    opcoes
                );

            // 4. Exportar conforme modo
            let zipBuffer;
            let contentType = 'application/zip';
            let nomeArquivo = `dip-${recursoId}`;

            const modo = opcoes.modo || 'completo';

            if (modo === 'individual' && ficheirosIncluidos.length === 1) {
                // Modo individual: retorna ficheiro raw
                const preparados = await this.prepararFicheirosParaExportacao(
                    contexto.aip,
                    ficheirosIncluidos,
                    'original'
                );
                const ficheiro = preparados[0];
                zipBuffer = ficheiro.conteudoBuffer || await fs.readFile(ficheiro.caminhoLocal);
                contentType = ficheiro.type || 'application/octet-stream';
                nomeArquivo = ficheiro.name;
            } else if (modo === 'subconjunto' || modo === 'completo') {
                // Modo subconjunto ou completo: retorna ZIP
                const JSZip = require('jszip');
                const zip = new JSZip();
                const preparados = await this.prepararFicheirosParaExportacao(
                    contexto.aip,
                    ficheirosIncluidos,
                    'original'
                );

                // Adicionar ficheiros
                for (const ficheiro of preparados) {
                    const conteudo = ficheiro.conteudoBuffer || await fs.readFile(ficheiro.caminhoLocal);
                    zip.file(ficheiro.name, conteudo);
                }

                // Adicionar metadados
                const metadadosDIP = {
                    recursoId: contexto.recurso._id.toString(),
                    titulo: contexto.recurso.titulo,
                    modo: modo,
                    dataExportacao: new Date().toISOString(),
                    ficheirosIncluidos: preparados.map(f => ({
                        nome: f.name,
                        tamanho: f.size,
                        tipo: f.type,
                        checksum: f.checksum_sha256
                    })),
                    ficheirosExcluidos: ficheirosExcluidos.map(f => f.name || f),
                    totalFicheiros: ficheirosIncluidos.length
                };

                zip.file('METADADOS-DIP.json', JSON.stringify(metadadosDIP, null, 2));

                zipBuffer = await zip.generateAsync({ type: 'nodebuffer' });
                nomeArquivo = `dip-${recursoId}-${modo}`;
            } else {
                throw new Error(`Modo desconhecido: ${modo}`);
            }

            // 5. Calcular checksum
            const crypto = require('crypto');
            const checksumDIP = crypto.createHash('sha256').update(zipBuffer).digest('hex');

            // 6. Preparar metadados de resposta
            const metadata = {
                recursoId: recursoId,
                aipId: contexto.aip._id.toString(),
                sipId: contexto.aip.sipId,
                tamanhoZIP: zipBuffer.length,
                checksumDIP: checksumDIP,
                nomeArquivo: modo === 'individual'
                    ? nomeArquivo
                    : `${nomeArquivo}-${Date.now()}.zip`,
                contentType: contentType,
                modo: modo,
                ficheirosIncluidos: ficheirosIncluidos.length
            };

            return { zipBuffer, metadata };

        } catch (err) {
            throw err;
        }
    }

};

module.exports = disseminacaoService;
