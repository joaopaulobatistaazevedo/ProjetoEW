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
                // Limpar ficheiro temporario
                try {
                    await fs.unlink(caminhoZip);
                } catch (err) {
                    console.error('Erro ao limpar ZIP:', err.message);
                }

                return res.status(400).json({
                    status: 'erro',
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
                checksumZip,
                req.user
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
    },

    // GET /ingestao/recursos/:recursoId/historico-aip — histórico de versões
    historicoAIP: async (req, res) => {
        try {
            const { recursoId } = req.params;
            
            // Verificar autenticação
            if (!req.user) {
                return res.status(401).json({
                    status: 'erro',
                    mensagem: 'Autenticação obrigatória'
                });
            }

            // Carregar todas as versões de AIP para este recurso
            const aips = await AIP.find({ recursoId })
                .sort({ versao: -1 })
                .populate('produtor', 'nome email')
                .populate('aipAnterior', 'sipId versao dataIngestao');

            if (aips.length === 0) {
                return res.status(404).json({
                    status: 'erro',
                    mensagem: 'Nenhum AIP encontrado para este recurso'
                });
            }

            // Apenas produtor/admin pode ver histórico de AIP privado
            const recurso = await Recurso.findById(recursoId);
            if (recurso.visibilidade === 'privado') {
                if (req.user.role !== 'admin' && req.user.id !== recurso.autor.toString()) {
                    return res.status(403).json({
                        status: 'erro',
                        mensagem: 'Acesso negado'
                    });
                }
            }

            // Formatar resposta
            const historico = aips.map(aip => ({
                versao: aip.versao,
                sipId: aip.sipId,
                status: aip.status,
                dataIngestao: aip.dataIngestao,
                motivoAtualizacao: aip.motivoAtualizacao,
                produtor: aip.produtor ? { nome: aip.produtor.nome, email: aip.produtor.email } : null,
                aipAnterior: aip.aipAnterior ? {
                    sipId: aip.aipAnterior.sipId,
                    versao: aip.aipAnterior.versao
                } : null,
                ficheirosNoAIP: aip.manifesto?.files?.length || 0
            }));

            res.json({
                status: 'ok',
                recursoId,
                totalVersoes: historico.length,
                versoes: historico
            });
        } catch (err) {
            console.error('Erro ao obter histórico AIP:', err);
            return res.status(500).json({
                status: 'erro',
                mensagem: 'Erro ao obter histórico',
                erro: err.message
            });
        }
    },

    // POST /ingestao/form — receber formulário + ficheiros, gerar SIP, processar
    submeterFormulario: async (req, res) => {
        try {
            const utilizadorId = req.user.id;

            // 1. Validar ficheiros
            if (!req.files || req.files.length === 0) {
                return res.status(400).json({
                    status: 'erro',
                    mensagem: 'Nenhum ficheiro foi selecionado',
                    categoria: 'upload'
                });
            }

            // 2. Gerar SIP do formulário
            const formToSIPGenerator = require('../services/formToSIPGenerator');
            const caminhoZipGerado = await formToSIPGenerator.gerarSIPDoFormulario(req.body, req.files);

            // 3. Validar SIP gerado
            const validador = new ValidadorSIP();
            const resultadoValidacao = await validador.validarCompleto(caminhoZipGerado);
            const checksumZip = await validador.calcularChecksumZip(caminhoZipGerado);

            // Se validação falhou
            if (!resultadoValidacao.ok) {
                try {
                    await fs.unlink(caminhoZipGerado);
                } catch (err) {
                    console.error('Erro ao limpar ZIP gerado:', err.message);
                }

                return res.status(400).json({
                    status: 'erro',
                    mensagem: 'SIP gerado falhou validação',
                    erros: resultadoValidacao.relatorio.erros,
                    avisos: resultadoValidacao.relatorio.avisos,
                    validacoes: resultadoValidacao.validacoes,
                    relatorio: resultadoValidacao.relatorio
                });
            }

            // 4. Processar SIP (mesmo fluxo que modo ZIP)
            const processor = new SIPProcessor();
            const resultado = await processor.processarSIP(
                resultadoValidacao.manifesto,
                utilizadorId,
                caminhoZipGerado,
                checksumZip,
                req.user
            );

            // 5. Retornar sucesso
            return res.status(201).json({
                status: 'ok',
                mensagem: 'Recurso criado com sucesso via formulário',
                recursoId: resultado.recursoId,
                aipId: resultado.aipId,
                modo: 'formulario'
            });
        } catch (err) {
            console.error('Erro ao submeter formulário:', err);
            return res.status(500).json({
                status: 'erro',
                mensagem: 'Erro ao processar formulário de ingestão',
                erro: err.message
            });
        }
    }
};

module.exports = ingestaoController;
