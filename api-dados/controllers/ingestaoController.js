const ValidadorSIP = require('../services/validadorSIP');
const SIPProcessor = require('../services/sIPProcessor');
const AIP = require('../models/aip');
const fs = require('fs').promises;

const ingestaoController = {
    // POST /ingestao/sip — receber, validar e processar SIP
    submeterSIP: async (req, res) => {
        if (!req.file) {
            return res.status(400).json({
                status: 'erro',
                mensagem: 'Nenhum ficheiro ZIP foi enviado',
                categoria: 'upload'
            });
        }

        const caminhoZip = req.file.path;
        // Do middleware de autenticacao
        const utilizadorId = req.user.id;

        try {
            // Instanciar validador
            const validador = new ValidadorSIP();

            // Validar completo (4 camadas)
            const resultadoValidacao = await validador.validarCompleto(caminhoZip);
            const checksumZip = await validador.calcularChecksumZip(caminhoZip);

            // Se validação falhou
            if (!resultadoValidacao.ok) {
                // Registar erro no AIP (para auditoria)
                const processor = new SIPProcessor();
                const aipId = await processor.registarErroAIP(
                    resultadoValidacao.manifesto,
                    utilizadorId,
                    checksumZip,
                    resultadoValidacao.relatorio.erros,
                    resultadoValidacao.relatorio.avisos
                );

                // Limpar ficheiro temporario
                try {
                    await fs.unlink(caminhoZip);
                } catch (err) {
                    console.error('Erro ao limpar ZIP:', err.message);
                }

                return res.status(400).json({
                    status: 'erro',
                    aipId: aipId,
                    mensagem: 'SIP rejeitado - validação falhou',
                    categoria: resultadoValidacao.relatorio.erros.length > 0
                        ? resultadoValidacao.relatorio.erros[0].categoria
                        : 'desconhecido',
                    erros: resultadoValidacao.relatorio.erros,
                    avisos: resultadoValidacao.relatorio.avisos,
                    validacoes: resultadoValidacao.validacoes,
                    relatorio: {
                        dataValidacao: resultadoValidacao.relatorio.dataValidacao,
                        numErros: resultadoValidacao.relatorio.erros.length,
                        numAvisos: resultadoValidacao.relatorio.avisos.length
                    }
                });
            }

            // Validacao passou — processar SIP
            const processor = new SIPProcessor();
            const resultadoProcessamento = await processor.processarSIP(
                resultadoValidacao.manifesto,
                utilizadorId,
                caminhoZip,
                checksumZip
            );

            return res.status(201).json({
                status: 'ok',
                aipId: resultadoProcessamento.aipId,
                recursoId: resultadoProcessamento.recursoId,
                mensagem: resultadoProcessamento.mensagem,
                storageLocal: resultadoProcessamento.storageLocal,
                relatorio: {
                    dataValidacao: resultadoValidacao.relatorio.dataValidacao,
                    validacoes: resultadoValidacao.validacoes,
                    avisos: resultadoValidacao.relatorio.avisos
                }
            });
        } catch (err) {
            console.error('Erro na ingestão SIP:', err);

            // Limpar ficheiro em caso de erro
            try {
                await fs.unlink(caminhoZip);
            } catch (err2) {
                console.error('Erro ao limpar ZIP:', err2.message);
            }

            return res.status(500).json({
                status: 'erro',
                mensagem: 'Erro interno ao processar SIP',
                erro: err.message,
                categoria: 'sistema'
            });
        }
    },

    // GET /ingestao/aips — listar AIPs do utilizador (com filtros)
    listarAIPs: async (req, res) => {
        try {
            const { status, page, limit } = req.query;
            const filtro = { produtor: req.user.id };

            if (status && ['ok', 'erro'].includes(status)) {
                filtro.status = status;
            }

            const pg = parseInt(page) > 0 ? parseInt(page) : 1;
            const lim = parseInt(limit) || 20;
            const skip = (pg - 1) * lim;

            const aips = await AIP.find(filtro)
                .sort({ dataIngestao: -1 })
                .skip(skip)
                .limit(lim)
                .populate('recursoId', 'titulo tipo')
                .exec();

            const total = await AIP.countDocuments(filtro);

            return res.json({
                status: 'ok',
                aips: aips,
                paginacao: {
                    pagina: pg,
                    limite: lim,
                    total: total,
                    paginas: Math.ceil(total / lim)
                }
            });
        } catch (err) {
            console.error('Erro ao listar AIPs:', err);
            return res.status(500).json({
                status: 'erro',
                mensagem: 'Erro ao listar AIPs',
                erro: err.message
            });
        }
    },

    // GET /ingestao/aips/:sipId — detalhe de um AIP específico
    detalheAIP: async (req, res) => {
        try {
            const aip = await AIP.findOne({ sipId: req.params.sipId })
                .populate('recursoId')
                .populate('produtor', 'nome email');

            if (!aip) {
                return res.status(404).json({
                    status: 'erro',
                    mensagem: 'AIP não encontrado'
                });
            }

            // Verificar autorização (produtor ou admin)
            if (aip.produtor._id.toString() !== req.user.id && req.user.role !== 'admin') {
                return res.status(403).json({
                    status: 'erro',
                    mensagem: 'Acesso negado'
                });
            }

            return res.json({
                status: 'ok',
                aip: aip
            });
        } catch (err) {
            console.error('Erro ao obter detalhe AIP:', err);
            return res.status(500).json({
                status: 'erro',
                mensagem: 'Erro ao obter AIP',
                erro: err.message
            });
        }
    },

    // GET /ingestao/aips/:sipId/relatorio — relatório detalhado de validação
    relatorioAIP: async (req, res) => {
        try {
            const aip = await AIP.findOne({ sipId: req.params.sipId })
                .populate('produtor', 'nome email');

            if (!aip) {
                return res.status(404).json({
                    status: 'erro',
                    mensagem: 'AIP não encontrado'
                });
            }

            // Verificar autorização
            if (aip.produtor._id.toString() !== req.user.id && req.user.role !== 'admin') {
                return res.status(403).json({
                    status: 'erro',
                    mensagem: 'Acesso negado'
                });
            }

            return res.json({
                status: 'ok',
                sipId: aip.sipId,
                recursoId: aip.recursoId,
                statusProcessamento: aip.status,
                validacoes: aip.validacoes,
                relatorio: aip.relatorio,
                dataIngestao: aip.dataIngestao,
                checksumSIP: aip.checksumSIP
            });
        } catch (err) {
            console.error('Erro ao obter relatório AIP:', err);
            return res.status(500).json({
                status: 'erro',
                mensagem: 'Erro ao obter relatório',
                erro: err.message
            });
        }
    }
};

module.exports = ingestaoController;
