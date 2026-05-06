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
        const aip = await AIP.findOne({ recursoId: recursoId })
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

    prepararFicheirosParaExportacao: async function(aip, ficheirosIncluidos, transformacao) {
        const pastaData = path.join(aip.storageLocal || '', 'data');
        const ficheirosPreparados = [];

        for (const ficheiro of ficheirosIncluidos) {
            const caminhoLocal = path.join(pastaData, ficheiro.name);

            let conteudoOriginal;
            try {
                conteudoOriginal = await fs.readFile(caminhoLocal);
            } catch (err) {
                throw criarErro(`Ficheiro preservado não encontrado no AIP: ${ficheiro.name}`, 500);
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
                formato: 'zip',
                tipoPedido,
                transformacao: pedido.transformacao,
                ficheirosSolicitados: pedido.ficheirosSolicitados,
                tamanhoZIP: zipBuffer.length,
                checksumDIP: checksumZIP,
                tempoProcessamento: tempoProcessamento,
                ficheirosIncluidos: dip.ficheirosIncluidos.length,
                ficheirosExcluidos: dip.ficheirosExcluidos.length
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
    }

};

module.exports = disseminacaoService;
