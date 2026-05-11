const TipoRecurso = require('../models/tipoRecurso');
const {
    slugifyTipo,
    listarTiposAtivos,
    listarTodosTipos
} = require('../services/tiposRecursoService');

const { normalizarPayload } = require('../utils/controllerUtils');

const tiposRecursoController = {
    getTiposAtivos: async (req, res) => {
        try {
            const tipos = await listarTiposAtivos();
            res.json(tipos);
        } catch (err) {
            res.status(500).json({ erro: err.message });
        }
    },

    getTodosTipos: async (req, res) => {
        try {
            const tipos = await listarTodosTipos();
            res.json(tipos);
        } catch (err) {
            res.status(500).json({ erro: err.message });
        }
    },

    createTipo: async (req, res) => {
        try {
            const { nome, descricao, ordem } = normalizarPayload(req.body, {
                nome: 'string',
                descricao: 'string',
                ordem: 'int'
            });

            if (!nome) {
                return res.status(400).json({ erro: 'O nome do tipo e obrigatorio.' });
            }

            const slug = slugifyTipo(nome);
            if (!slug) {
                return res.status(400).json({ erro: 'Nao foi possivel gerar um identificador valido para o tipo.' });
            }

            const existente = await TipoRecurso.findOne({
                $or: [
                    { slug },
                    { nome: new RegExp(`^${nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') }
                ]
            });

            if (existente) {
                return res.status(409).json({ erro: 'Ja existe um tipo de recurso com esse nome.' });
            }

            const tipo = await TipoRecurso.create({
                slug,
                nome,
                descricao,
                ordem
            });

            res.status(201).json(tipo);
        } catch (err) {
            res.status(500).json({ erro: err.message });
        }
    },

    updateTipo: async (req, res) => {
        try {
            const tipo = await TipoRecurso.findById(req.params.id);
            if (!tipo) {
                return res.status(404).json({ erro: 'Tipo de recurso nao encontrado.' });
            }

            const { nome, descricao, ordem, ativo } = normalizarPayload(req.body, {
                nome: 'string',
                descricao: 'string',
                ordem: 'int',
                ativo: 'boolean'
            });

            if (nome) {
                const conflito = await TipoRecurso.findOne({
                    _id: { $ne: tipo._id },
                    nome: new RegExp(`^${nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
                });

                if (conflito) {
                    return res.status(409).json({ erro: 'Ja existe outro tipo de recurso com esse nome.' });
                }

                tipo.nome = nome;
            }

            if (req.body.descricao !== undefined) {
                tipo.descricao = descricao;
            }

            if (req.body.ordem !== undefined) {
                tipo.ordem = ordem;
            }

            if (ativo !== undefined) {
                tipo.ativo = ativo;
            }

            await tipo.save();
            res.json(tipo);
        } catch (err) {
            res.status(500).json({ erro: err.message });
        }
    }
};

module.exports = tiposRecursoController;
