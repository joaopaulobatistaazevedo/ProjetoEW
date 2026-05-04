const disseminacaoService = require('../services/disseminacaoService');
const verificacaoPermissoes = require('../services/verificacaoPermissoes');
const Recurso = require('../models/recurso');

const disseminacaoController = {
    
    /**
     * GET /recursos/{recursoId}/exportar
     * Exporta um recurso individual como DIP-ZIP
     */
    exportarRecurso: async (req, res) => {
        try {
            const { recursoId } = req.params;
            const utilizadorId = req.user.id;
            const papelUtilizador = req.user.papel || 'consumidor';
            
            // A verificação de permissão já foi feita pelo middleware
            // O recurso está em req.recurso
            
            // Exportar
            const { zipBuffer, metadata, dip } = await disseminacaoService.exportarRecurso(
                recursoId,
                utilizadorId,
                papelUtilizador
            );
            
            // Registar na auditoria (não falhar se falhar auditoria)
            try {
                await disseminacaoService.registarExportacao(
                    metadata.aipId,
                    recursoId,
                    utilizadorId,
                    metadata,
                    req
                );
            } catch (auditErr) {
                console.warn('Aviso: Falha ao registar auditoria:', auditErr.message);
            }
            
            // Preparar response
            const nomeArquivo = `recurso-${recursoId}-${Date.now()}.zip`;
            
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
            res.setHeader('Content-Length', zipBuffer.length);
            res.setHeader('X-DIP-Checksum', metadata.checksumDIP);
            res.setHeader('X-DIP-Size', metadata.tamanhoZIP);
            
            res.send(zipBuffer);
            
        } catch (err) {
            console.error('Erro ao exportar recurso:', err);
            res.status(500).json({
                status: 'erro',
                mensagem: 'Erro ao exportar recurso',
                erro: err.message
            });
        }
    },
    
    /**
     * GET /recursos/exportar-multiplos
     * Exporta múltiplos recursos num lote
     */
    exportarMultiplos: async (req, res) => {
        try {
            const { ids } = req.query;
            const utilizadorId = req.user.id;
            const papelUtilizador = req.user.papel || 'consumidor';
            
            if (!ids) {
                return res.status(400).json({
                    status: 'erro',
                    mensagem: 'Parâmetro "ids" é obrigatório (ex: ?ids=507f,508a)'
                });
            }
            
            // Parsear IDs
            const recursoIds = ids.split(',').map(id => id.trim()).filter(Boolean);
            
            if (recursoIds.length === 0) {
                return res.status(400).json({
                    status: 'erro',
                    mensagem: 'Nenhum ID de recurso válido fornecido'
                });
            }
            
            if (recursoIds.length > 100) {
                return res.status(400).json({
                    status: 'erro',
                    mensagem: 'Máximo de 100 recursos por lote'
                });
            }
            
            // Verificar permissões para cada recurso
            const recursosPermitidos = [];
            for (const recursoId of recursoIds) {
                try {
                    const { temPermissao } = await verificacaoPermissoes.podeExportarRecurso(
                        recursoId,
                        utilizadorId,
                        papelUtilizador
                    );
                    
                    if (temPermissao) {
                        recursosPermitidos.push(recursoId);
                    }
                } catch (err) {
                    console.warn(`Aviso ao verificar permissão de ${recursoId}:`, err.message);
                }
            }
            
            if (recursosPermitidos.length === 0) {
                return res.status(403).json({
                    status: 'erro',
                    mensagem: 'Não tem permissão para exportar nenhum dos recursos solicitados'
                });
            }
            
            // Exportar lote
            const zipBuffer = await disseminacaoService.exportarMultiplos(
                recursosPermitidos,
                utilizadorId,
                papelUtilizador
            );
            
            // Response
            const nomeArquivo = `recursos-lote-${Date.now()}.zip`;
            
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
            res.setHeader('Content-Length', zipBuffer.length);
            res.setHeader('X-Resources-Count', recursosPermitidos.length);
            
            res.send(zipBuffer);
            
        } catch (err) {
            console.error('Erro ao exportar múltiplos:', err);
            res.status(500).json({
                status: 'erro',
                mensagem: 'Erro ao exportar lote',
                erro: err.message
            });
        }
    },
    
    /**
     * GET /recursos/{recursoId}/historico-exportacoes
     * Lista histórico de exportações (auditoria)
     */
    historicoExportacoes: async (req, res) => {
        try {
            const { recursoId } = req.params;
            
            // Permissão já verificada pelo middleware
            
            const Exportacao = require('../models/exportacao');
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const skip = (page - 1) * limit;
            
            const exportacoes = await Exportacao
                .find({ recursoId: recursoId })
                .sort({ dataExportacao: -1 })
                .skip(skip)
                .limit(limit)
                .populate('exportadoPor', 'nome email');
            
            const total = await Exportacao.countDocuments({ recursoId: recursoId });
            
            res.json({
                status: 'ok',
                exportacoes: exportacoes,
                paginacao: {
                    pagina: page,
                    limite: limit,
                    total: total,
                    paginas: Math.ceil(total / limit)
                }
            });
            
        } catch (err) {
            console.error('Erro ao listar histórico:', err);
            res.status(500).json({
                status: 'erro',
                mensagem: 'Erro ao listar histórico',
                erro: err.message
            });
        }
    },
    
    /**
     * GET /recursos/meus-recursos/exportar-todos
     * Exporta todos os recursos do utilizador autenticado
     */
    exportarTodosRecursos: async (req, res) => {
        try {
            const utilizadorId = req.user.id;
            const papelUtilizador = req.user.papel;
            
            // Buscar todos os recursos do utilizador
            const recursos = await Recurso.find({ autor: utilizadorId })
                .select('_id');
            
            if (recursos.length === 0) {
                return res.status(404).json({
                    status: 'erro',
                    mensagem: 'Nenhum recurso encontrado'
                });
            }
            
            const recursoIds = recursos.map(r => r._id.toString());
            
            // Exportar
            const zipBuffer = await disseminacaoService.exportarMultiplos(
                recursoIds,
                utilizadorId,
                papelUtilizador
            );
            
            // Response
            const nomeArquivo = `meus-recursos-${Date.now()}.zip`;
            
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
            res.setHeader('Content-Length', zipBuffer.length);
            
            res.send(zipBuffer);
            
        } catch (err) {
            console.error('Erro ao exportar todos os recursos:', err);
            res.status(500).json({
                status: 'erro',
                mensagem: 'Erro ao exportar recursos',
                erro: err.message
            });
        }
    }
    
};

module.exports = disseminacaoController;
