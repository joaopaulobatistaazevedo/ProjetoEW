const AIP = require('../models/aip');
const Recurso = require('../models/recurso');
const Exportacao = require('../models/exportacao');
const zipGenerator = require('./zipGenerator');
const verificacaoPermissoes = require('./verificacaoPermissoes');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * Serviço: Disseminação (DIP)
 * Responsável por construir DIPs e exportar recursos
 */
class DisseminacaoService {
    
    /**
     * Carrega um AIP da base de dados
     * @param {string} recursoId - ID do recurso
     * @returns {Promise<object>}
     */
    async carregarAIP(recursoId) {
        try {
            const aip = await AIP.findOne({ recursoId: recursoId })
                .populate('recursoId', 'id titulo tipo visibilidade autor')
                .populate('produtor', 'id nome email');
            
            if (!aip) {
                throw new Error(`AIP não encontrado para recurso ${recursoId}`);
            }
            
            return aip;
            
        } catch (err) {
            console.error('Erro ao carregar AIP:', err);
            throw err;
        }
    }
    
    /**
     * Constrói um DIP a partir de um AIP
     * Aplica filtros de visibilidade e enriquece metadados
     * 
     * @param {object} aip - AIP da BD
     * @param {string} utilizadorId - ID do utilizador solicitante
     * @param {string} papelUtilizador - Papel do utilizador
     * @returns {Promise<object>} DIP estruturado
     */
    async construirDIP(aip, utilizadorId, papelUtilizador = 'consumidor') {
        try {
            // 1. Filtrar ficheiros por visibilidade
            const filtro = await verificacaoPermissoes.filtrarFicheirosParaDIP(
                aip,
                utilizadorId,
                papelUtilizador
            );
            
            // 2. Buscar recurso para dados complementares
            const recurso = await Recurso.findById(aip.recursoId)
                .populate('autor', 'id nome email');
            
            // 3. Construir DIP
            const dip = {
                aipId: aip.sipId,
                recursoId: aip.recursoId,
                dataIngestao: aip.dataIngestao,
                
                manifesto_original: aip.manifesto,
                
                metadados_originais: {
                    titulo: recurso.titulo,
                    subtitulo: recurso.subtitulo,
                    tipo: recurso.tipo,
                    hashtags: recurso.hashtags,
                    visibilidade: recurso.visibilidade,
                    dataCriacao: recurso.dataCriacao,
                    descricao: recurso.descricao,
                    autor: {
                        id: recurso.autor._id,
                        nome: recurso.autor.nome,
                        email: recurso.autor.email
                    }
                },
                
                metadados_enriquecidos: {
                    dataIngestao: aip.dataIngestao,
                    dataExportacao: new Date(),
                    exportadoPor: utilizadorId,
                    versionAIP: 1,
                    visibilidade: recurso.visibilidade
                },
                
                ficheirosIncluidos: filtro.ficheirosIncluidos,
                ficheirosExcluidos: filtro.ficheirosExcluidos,
                
                versionAIP: 1
            };
            
            return dip;
            
        } catch (err) {
            console.error('Erro ao construir DIP:', err);
            throw err;
        }
    }
    
    /**
     * Enriquece DIP com informações de ficheiros (caminhos locais, checksums)
     * @param {object} dip 
     * @param {string} storageLocal - Caminho no storage
     * @returns {Promise<object>}
     */
    async enriquecerDIPComFicheiros(dip, storageLocal) {
        try {
            // Verificar se os ficheiros existem no storage
            const pastaData = path.join(storageLocal, 'data');
            
            for (const ficheiro of dip.ficheirosIncluidos) {
                const caminhoLocal = path.join(pastaData, ficheiro.name);
                
                // Verificar se ficheiro existe
                try {
                    await fs.access(caminhoLocal);
                    ficheiro.caminhoLocal = caminhoLocal;
                    
                    // Se não tem checksum, calcular
                    if (!ficheiro.checksum_sha256 || ficheiro.checksum_sha256 === 'pendente') {
                        const conteudo = await fs.readFile(caminhoLocal);
                        ficheiro.checksum_sha256 = crypto
                            .createHash('sha256')
                            .update(conteudo)
                            .digest('hex');
                    }
                } catch (err) {
                    console.warn(`Aviso: Ficheiro não encontrado: ${caminhoLocal}`);
                    // Não falhar, apenas marcar como indisponível
                    ficheiro.caminhoLocal = null;
                }
            }
            
            return dip;
            
        } catch (err) {
            console.error('Erro ao enriquecer DIP com ficheiros:', err);
            throw err;
        }
    }
    
    /**
     * Exporta um recurso individual como DIP-ZIP
     * 
     * @param {string} recursoId - ID do recurso a exportar
     * @param {string} utilizadorId - ID do utilizador solicitante
     * @param {string} papelUtilizador - Papel do utilizador
     * @param {object} opcoes - Opções (formato, etc)
     * 
     * @returns {Promise<object>} { zipBuffer, metadata }
     */
    async exportarRecurso(recursoId, utilizadorId, papelUtilizador, opcoes = {}) {
        const tempoInicio = Date.now();
        
        try {
            // 1. Carregar AIP
            const aip = await this.carregarAIP(recursoId);
            
            // 2. Construir DIP
            const dip = await this.construirDIP(aip, utilizadorId, papelUtilizador);
            
            // 3. Enriquecer com informações de ficheiros
            const dipEnriquecido = await this.enriquecerDIPComFicheiros(
                dip,
                aip.storageLocal
            );
            
            // 4. Gerar ZIP
            const zipBuffer = await zipGenerator.gerarDIPZip(
                dipEnriquecido,
                aip.sipId,
                recursoId,
                utilizadorId,
                opcoes
            );
            
            // 5. Calcular checksum do ZIP
            const checksumZIP = crypto
                .createHash('sha256')
                .update(zipBuffer)
                .digest('hex');
            
            const tempoProcessamento = Date.now() - tempoInicio;
            
            // 6. Preparar metadata para auditoria
            const metadata = {
                aipId: aip.sipId,
                recursoId: recursoId,
                tamanhoZIP: zipBuffer.length,
                checksumDIP: checksumZIP,
                tempoProcessamento: tempoProcessamento,
                ficheirosIncluidos: dipEnriquecido.ficheirosIncluidos.length,
                ficheirosExcluidos: dipEnriquecido.ficheirosExcluidos.length
            };
            
            return {
                zipBuffer,
                metadata,
                dip: dipEnriquecido
            };
            
        } catch (err) {
            console.error('Erro ao exportar recurso:', err);
            throw err;
        }
    }
    
    /**
     * Registra uma exportação na auditoria
     * @param {string} aipId 
     * @param {string} recursoId 
     * @param {string} utilizadorId 
     * @param {object} metadata 
     * @param {object} req - Request HTTP (para IP, user-agent)
     * @returns {Promise<object>} Entrada Exportacao criada
     */
    async registarExportacao(aipId, recursoId, utilizadorId, metadata, req) {
        try {
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
                ipSolicitante: req.ip || req.connection.remoteAddress,
                userAgent: req.get('user-agent')
            });
            
            await exportacao.save();
            
            // Incrementar contagem de downloads no AIP
            await AIP.findByIdAndUpdate(
                aip._id,
                { $inc: { downloadCount: 1 } }
            );
            
            return exportacao;
            
        } catch (err) {
            console.error('Erro ao registar exportação:', err);
            // Não falhar a operação se auditoria falhar
            console.warn('Aviso: Auditoria não foi registada, mas exportação foi bem-sucedida');
            return null;
        }
    }
    
    /**
     * Exporta múltiplos recursos num único ZIP
     * Estrutura: recursos-lote/
     *   ├── recurso-{id1}/
     *   │   ├── manifest.json
     *   │   └── data/
     *   ├── recurso-{id2}/
     *   └── lote-metadados.json
     * 
     * @param {array} recursoIds - Array de IDs de recursos
     * @param {string} utilizadorId 
     * @param {string} papelUtilizador 
     * @returns {Promise<Buffer>} ZIP do lote
     */
    async exportarMultiplos(recursoIds, utilizadorId, papelUtilizador) {
        try {
            const AdmZip = require('adm-zip');
            const zipLote = new AdmZip();
            
            const metadadosLote = {
                tipo_pacote: 'DIP_LOTE',
                versao: '1.0',
                dataExportacao: new Date().toISOString(),
                exportadoPor: utilizadorId,
                numeroRecursos: recursoIds.length,
                recursos: []
            };
            
            // Processar cada recurso
            for (const recursoId of recursoIds) {
                try {
                    const { zipBuffer, metadata } = await this.exportarRecurso(
                        recursoId,
                        utilizadorId,
                        papelUtilizador
                    );
                    
                    // Extrair e reorganizar ficheiros do ZIP
                    const zipItem = new AdmZip(zipBuffer);
                    const entries = zipItem.getEntries();
                    
                    for (const entry of entries) {
                        const novoNome = `recurso-${recursoId}/${entry.entryName}`;
                        if (entry.isDirectory) {
                            zipLote.addFile(novoNome + '/');
                        } else {
                            zipLote.addFile(novoNome, entry.getData());
                        }
                    }
                    
                    metadadosLote.recursos.push({
                        recursoId: recursoId,
                        aipId: metadata.aipId,
                        tamanho: metadata.tamanhoZIP,
                        checksum: metadata.checksumDIP
                    });
                    
                } catch (err) {
                    console.warn(`Aviso: Recurso ${recursoId} não foi exportado:`, err.message);
                    metadadosLote.recursos.push({
                        recursoId: recursoId,
                        erro: err.message
                    });
                }
            }
            
            zipLote.addFile(
                'lote-metadados.json',
                Buffer.from(JSON.stringify(metadadosLote, null, 2))
            );
            
            return zipLote.toBuffer();
            
        } catch (err) {
            console.error('Erro ao exportar múltiplos recursos:', err);
            throw err;
        }
    }
    
}

module.exports = new DisseminacaoService();
