const AIP = require('../models/aip');
const Recurso = require('../models/recurso');
const zipGenerator = require('./zipGenerator');
const Exportacao = require('../models/exportacao');
const JSZip = require('jszip');
const verificacaoPermissoes = require('./verificacaoPermissoes');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * Serviço: Disseminação (DIP) - VERSÃO SIMPLIFICADA
 * 
 * Responsabilidade ÚNICA: Exportar recurso como DIP-ZIP
 * 
 * Fluxo:
 * 1. Carregar AIP (metadados + lista de ficheiros)
 * 2. Aplicar filtros de visibilidade
 * 3. Enriquecer com caminhos locais e checksums
 * 4. Gerar ZIP (BagIt format)
 * 5. Retornar { zipBuffer, metadata, dip }
 */
const disseminacaoService = {

    /**
     * Exporta um recurso como DIP-ZIP
     * @param {string} recursoId - ID do recurso
     * @param {string} utilizadorId - ID do utilizador (para logs)
     * @param {string} papelUtilizador - 'produtor', 'consumidor', etc
     * @returns {Promise<{zipBuffer, metadata, dip}>}
     */
    exportarRecurso: async function(recursoId, utilizadorId, papelUtilizador = 'consumidor') {
        const tempoInicio = Date.now();
        
        try {
            // 1. CARREGAR AIP (do storage + BD)
            const aip = await AIP.findOne({ recursoId: recursoId })
                .populate('recursoId', 'titulo visibilidade autor');
            
            if (!aip) {
                throw new Error(`AIP não encontrado para recurso ${recursoId}`);
            }

            // 2. CARREGAR RECURSO
            const recurso = await Recurso.findById(recursoId);
            if (!recurso) {
                throw new Error(`Recurso ${recursoId} não encontrado`);
            }
            
            // 3. APLICAR FILTROS DE VISIBILIDADE
            const filtro = await verificacaoPermissoes.filtrarFicheirosParaDIP(
                aip,
                utilizadorId,
                papelUtilizador
            );

            const manifesto = aip.manifesto || {};

            // 4. CONSTRUIR DIP (estrutura compatível com zipGenerator)
            const dip = {
                metadados: {
                    titulo: manifesto.titulo,
                    subtitulo: manifesto.subtitulo,
                    tipo: manifesto.tipo,
                    hashtags: manifesto.hashtags || [],
                    visibilidade: recurso.visibilidade,
                    dataCriacao: manifesto.dataCriacao,
                    descricao: manifesto.descricao
                },
                metadados_enriquecidos: {
                    dataIngestao: aip.dataIngestao,
                    dataExportacao: new Date().toISOString(),
                    produtorId: aip.produtor,
                    exportadoPor: utilizadorId,
                    versionAIP: '1',
                    estadoArmazenamento: aip.status || 'ok',
                    visibilidade: recurso.visibilidade
                },
                ficheirosIncluidos: filtro.ficheirosIncluidos || [],
                ficheirosExcluidos: filtro.ficheirosExcluidos || []
            };

            // 5. ENRIQUECER FICHEIROS (caminhos locais + checksums)
            const pastaData = path.join(aip.storageLocal || '', 'data');
            
            for (const ficheiro of dip.ficheirosIncluidos) {
                const caminhoLocal = path.join(pastaData, ficheiro.name);
                
                try {
                    // Verificar se ficheiro existe
                    await fs.access(caminhoLocal);
                    ficheiro.caminhoLocal = caminhoLocal;
                    
                    // Calcular checksum se não existe
                    if (!ficheiro.checksum_sha256 || ficheiro.checksum_sha256 === 'pendente') {
                        const conteudo = await fs.readFile(caminhoLocal);
                        ficheiro.checksum_sha256 = crypto
                            .createHash('sha256')
                            .update(conteudo)
                            .digest('hex');
                    }
                } catch (err) {
                    console.warn(`⚠ Ficheiro não encontrado: ${caminhoLocal}`);
                    ficheiro.caminhoLocal = null;
                }
            }

            // 6. GERAR ZIP (BagIt format)
            const zipBuffer = await zipGenerator.gerarDIPZip(
                dip,
                aip._id.toString(),
                recursoId,
                utilizadorId
            );

            // 7. CALCULAR CHECKSUM DO ZIP
            const checksumZIP = crypto
                .createHash('sha256')
                .update(zipBuffer)
                .digest('hex');

            const tempoProcessamento = Date.now() - tempoInicio;

            // 8. PREPARAR METADATA PARA LOGS/AUDITORIA
            const metadata = {
                aipId: aip._id.toString(),
                recursoId: recursoId,
                tamanhoZIP: zipBuffer.length,
                checksumDIP: checksumZIP,
                tempoProcessamento: tempoProcessamento,
                ficheirosIncluidos: dip.ficheirosIncluidos.length,
                ficheirosExcluidos: dip.ficheirosExcluidos.length
            };

            console.log(`✅ DIP exportado: ${recursoId} (${(zipBuffer.length / 1024).toFixed(2)}KB) em ${tempoProcessamento}ms`);

            return {
                zipBuffer,
                metadata,
                dip
            };

        } catch (err) {
            console.error(`❌ Erro ao exportar recurso ${recursoId}:`, err.message);
            throw err;
        }
    }

    /**
     * Registar uma exportação na auditoria (melhor esforço)
     */
    ,registarExportacao: async function(aipId, recursoId, utilizadorId, metadata, req) {
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
                    ficheirosExcluidos: metadata.ficheirosExcluidos
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
    }

    /**
     * Exportar múltiplos recursos num único ZIP (lote)
     */
    ,exportarMultiplos: async function(recursoIds, utilizadorId, papelUtilizador) {
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
                    const { zipBuffer, metadata } = await this.exportarRecurso(recursoId, utilizadorId, papelUtilizador);

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

            const buffer = await zipLote.generateAsync({
                type: 'nodebuffer',
                compression: 'DEFLATE',
                compressionOptions: { level: 9 }
            });

            return buffer;
        } catch (err) {
            throw err;
        }
    }

};

module.exports = disseminacaoService;


