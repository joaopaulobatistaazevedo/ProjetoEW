const path = require('path');
const Recurso = require('../models/recurso');

// Normalize hashtags input into array of strings
function normalizarHashtags(valor) {
    if (!valor) return [];
    if (Array.isArray(valor)) return valor.map(tag => String(tag).trim()).filter(Boolean);

    if (typeof valor === 'string') {
        try {
            const parsed = JSON.parse(valor);
            if (Array.isArray(parsed)) {
                return parsed.map(tag => String(tag).trim()).filter(Boolean);
            }
        } catch (err) {
            return valor.split(',').map(tag => tag.trim()).filter(Boolean);
        }
    }

    return [];
}

const recursosController = {

    // GET /recursos — listar com filtros (público)
    getAllRecursos: async (req, res) => {
        try {
            const { q, tipo, hashtag, ano, visibilidade, autor, produtor, sort, order, limit, page } = req.query;
            const filtro = {};

            if (q)               filtro.$text = { $search: q };
            if (tipo)         filtro.tipo = tipo;
            if (visibilidade) filtro.visibilidade = visibilidade;
            if (hashtag)      filtro.hashtags = hashtag;
            if (autor || produtor) filtro.autor = autor || produtor;
            if (ano)          filtro.dataCriacao = {
                $gte: new Date(`${ano}-01-01`),
                $lte: new Date(`${ano}-12-31`)
            };

            // Ordenacao com ranking opcional por relevancia
            let sortObj = { dataRegisto: -1 };
            const ord = order === 'asc' ? 1 : -1;
            if (sort === 'mediaEstrelas') sortObj = { mediaEstrelas: ord };
            else if (sort === 'dataRegisto') sortObj = { dataRegisto: ord };
            else if (sort === 'relevancia' || q) sortObj = q
                ? { score: { $meta: 'textScore' }, mediaEstrelas: -1, dataRegisto: -1 }
                : { mediaEstrelas: -1, dataRegisto: -1 };

            const lim = parseInt(limit) || 50;
            const pg = parseInt(page) > 0 ? parseInt(page) : 1;
            const skip = (pg - 1) * lim;

            // Query base com populate e pagina
            const query = Recurso.find(filtro)
                .populate('autor', 'nome email')
                .sort(sortObj)
                .skip(skip)
                .limit(lim);

            if (q) {
                query.select({ score: { $meta: 'textScore' } });
            }

            const recursos = await query;

            res.json(recursos);
        } catch (err) {
            res.status(500).json({ erro: err.message });
        }
    },

    // GET /recursos/top3 — top 3 por média de estrelas (público)
    getTop3Recursos: async (req, res) => {
        try {
            const top3 = await Recurso.find({ visibilidade: 'publico' })
                .sort({ mediaEstrelas: -1 })
                .limit(3)
                .populate('autor', 'nome');

            res.json(top3);
        } catch (err) {
            res.status(500).json({ erro: err.message });
        }
    },

    // GET /recursos/:id — detalhe (público)
    getRecursoById: async (req, res) => {
        try {
            const recurso = await Recurso.findById(req.params.id)
                .populate('autor', 'nome email');

            if (!recurso) return res.status(404).json({ erro: 'Recurso não encontrado' });
            res.json(recurso);
        } catch (err) {
            res.status(500).json({ erro: err.message });
        }
    },

    // GET /recursos/:id/download — autenticado, respeita visibilidade
    downloadRecurso: async (req, res) => {
        try {
            const recurso = await Recurso.findById(req.params.id);
            if (!recurso) return res.status(404).json({ erro: 'Recurso não encontrado' });
            if (!recurso.ficheiro) return res.status(404).json({ erro: 'Sem ficheiro associado' });

            // Privado: apenas admin ou autor
            if (recurso.visibilidade === 'privado') {
                if (req.user.role !== 'admin' && req.user.id !== recurso.autor.toString()) {
                    return res.status(403).json({ erro: 'Sem permissão' });
                }
            }

            res.download(path.resolve(recurso.ficheiro));
        } catch (err) {
            res.status(500).json({ erro: err.message });
        }
    },

    // POST /recursos — criar (qualquer autenticado, será promovido a produtor)
    createRecurso: async (req, res) => {
        try {
            const { titulo, subtitulo, tipo, dataCriacao, visibilidade, hashtags } = req.body;

            // Validações básicas
            if (!titulo || !tipo) return res.status(400).json({ erro: 'Titulo e tipo são obrigatórios' });

            const tags = normalizarHashtags(hashtags);

            const recurso = await Recurso.create({
                titulo,
                subtitulo,
                descricao: req.body.descricao,
                tipo,
                dataCriacao: dataCriacao ? new Date(dataCriacao) : undefined,
                visibilidade,
                hashtags: tags,
                autor: req.user.id,
                ficheiro: req.file ? req.file.path : null
            });

            // Promover utilizador a produtor se consumidor (nao bloqueia resposta)
            if (req.user.role === 'consumidor') {
                const axios = require('axios');
                const AUTH_SERVICE_URL = process.env.AUTH_URL || 'http://localhost:2623';
                const token = req.headers.authorization?.split(' ')[1];
                
                axios.put(
                    `${AUTH_SERVICE_URL}/users/${req.user.id}/promote/produtor`,
                    {},
                    { headers: { Authorization: `Bearer ${token}` } }
                ).catch(err => console.error('Erro ao promover para produtor:', err.message));
            }

            res.status(201).json(recurso);
        } catch (err) {
            res.status(500).json({ erro: err.message });
        }
    },

    // PUT /recursos/:id — editar (admin ou autor dono)
    updateRecurso: async (req, res) => {
        try {
            const recurso = await Recurso.findById(req.params.id);
            if (!recurso) return res.status(404).json({ erro: 'Recurso não encontrado' });

            if (req.user.role !== 'admin' && req.user.id !== recurso.autor.toString()) {
                return res.status(403).json({ erro: 'Sem permissão' });
            }

            // Sanitizar e validar campos atualizaveis
            const allowed = ['titulo','subtitulo','descricao','tipo','dataCriacao','visibilidade','hashtags','ficheiro'];
            const update = {};
            for (const k of allowed) {
                if (req.body[k] !== undefined) update[k] = req.body[k];
            }
            if (update.hashtags) {
                update.hashtags = normalizarHashtags(update.hashtags);
            }

            if (update.dataCriacao) update.dataCriacao = new Date(update.dataCriacao);

            const atualizado = await Recurso.findByIdAndUpdate(req.params.id, update, { new: true, runValidators: true });
            res.json(atualizado);
        } catch (err) {
            res.status(500).json({ erro: err.message });
        }
    },

    // DELETE /recursos/:id — apagar (admin ou autor dono)
    deleteRecurso: async (req, res) => {
        try {
            const recurso = await Recurso.findById(req.params.id);
            if (!recurso) return res.status(404).json({ erro: 'Recurso não encontrado' });

            if (req.user.role !== 'admin' && req.user.id !== recurso.autor.toString()) {
                return res.status(403).json({ erro: 'Sem permissão' });
            }

            await Recurso.findByIdAndDelete(req.params.id);
            res.json({ mensagem: 'Recurso eliminado' });
        } catch (err) {
            res.status(500).json({ erro: err.message });
        }
    },

    // PATCH /recursos/:id/rate — avaliar (autenticado)
    rateRecurso: async (req, res) => {
        try {
            const { estrelas } = req.body;
            if (!estrelas || estrelas < 1 || estrelas > 5)
                return res.status(400).json({ erro: 'Estrelas deve ser entre 1 e 5' });

            const recurso = await Recurso.findById(req.params.id);
            if (!recurso) return res.status(404).json({ erro: 'Recurso não encontrado' });

            // Atualiza rating existente ou cria novo
            const indice = recurso.ratings.findIndex(r => r.utilizador.toString() === req.user.id);
            if (indice >= 0) {
                recurso.ratings[indice].estrelas = estrelas;
            } else {
                recurso.ratings.push({ utilizador: req.user.id, estrelas });
            }

            await recurso.save();
            res.json({ mediaEstrelas: recurso.mediaEstrelas, totalVotos: recurso.ratings.length });
        } catch (err) {
            res.status(500).json({ erro: err.message });
        }
    }
};

module.exports = recursosController;