const Noticia = require('../models/noticia');

const noticiasController = {
    // GET /noticias
    getAllNoticias: async (req, res) => {
        try {
            const limit = parseInt(req.query.limit) || 20;
            const noticias = await Noticia.find()
                .sort({ dataCriacao: -1 })
                .limit(limit);
            res.json(noticias);
        } catch (err) {
            res.status(500).json({ erro: err.message });
        }
    },

    // POST /noticias
    createNoticia: async (req, res) => {
        try {
            const { titulo, conteudo, tipo, link, autorNome } = req.body;
            if (!titulo) return res.status(400).json({ erro: 'Titulo obrigatório' });
            const noticia = await Noticia.create({ titulo, conteudo, tipo, link, autorNome });
            res.status(201).json(noticia);
        } catch (err) {
            res.status(500).json({ erro: err.message });
        }
    }
};

module.exports = noticiasController;
