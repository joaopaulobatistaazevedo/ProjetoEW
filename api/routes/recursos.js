const express = require('express');
const path = require('path');
const Recurso = require('../models/recurso');
const upload = require('../middleware/upload');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// GET /recursos — listar com filtros (público)
router.get('/', async (req, res) => {
    try {
        const { tipo, hashtag, ano, visibilidade } = req.query;
        const filtro = {};

        if (tipo)         filtro.tipo = tipo;
        if (visibilidade) filtro.visibilidade = visibilidade;
        if (hashtag)      filtro.hashtags = hashtag;
        if (ano)          filtro.dataCriacao = {
            $gte: new Date(`${ano}-01-01`),
            $lte: new Date(`${ano}-12-31`)
        };

        const recursos = await Recurso.find(filtro)
            .populate('produtor', 'nome email')
            .sort({ dataRegisto: -1 });

        res.json(recursos);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// GET /recursos/top3 — top 3 por média de estrelas (público)
router.get('/top3', async (req, res) => {
    try {
        const top3 = await Recurso.find({ visibilidade: 'publico' })
            .sort({ mediaEstrelas: -1 })
            .limit(3)
            .populate('produtor', 'nome');

        res.json(top3);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// GET /recursos/:id — detalhe (público)
router.get('/:id', async (req, res) => {
    try {
        const recurso = await Recurso.findById(req.params.id)
            .populate('produtor', 'nome email');

        if (!recurso) return res.status(404).json({ erro: 'Recurso não encontrado' });
        res.json(recurso);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// GET /recursos/:id/download — autenticado, respeita visibilidade
router.get('/:id/download', authenticate, async (req, res) => {
    try {
        const recurso = await Recurso.findById(req.params.id);
        if (!recurso) return res.status(404).json({ erro: 'Recurso não encontrado' });
        if (!recurso.ficheiro) return res.status(404).json({ erro: 'Sem ficheiro associado' });

        // privado: só admin ou o próprio produtor
        if (recurso.visibilidade === 'privado') {
            if (req.user.role !== 'admin' && req.user.id !== recurso.produtor.toString()) {
                return res.status(403).json({ erro: 'Sem permissão' });
            }
        }

        res.download(path.resolve(recurso.ficheiro));
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// POST /recursos — criar (produtor ou admin)
router.post('/', authenticate, authorize('produtor', 'admin'), upload.single('ficheiro'), async (req, res) => {
    try {
        const { titulo, subtitulo, tipo, dataCriacao, visibilidade, hashtags } = req.body;

        const recurso = await Recurso.create({
            titulo,
            subtitulo,
            tipo,
            dataCriacao,
            visibilidade,
            hashtags: hashtags ? JSON.parse(hashtags) : [],
            produtor: req.user.id,
            ficheiro: req.file ? req.file.path : null
        });

        res.status(201).json(recurso);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// PUT /recursos/:id — editar (admin ou produtor dono)
router.put('/:id', authenticate, async (req, res) => {
    try {
        const recurso = await Recurso.findById(req.params.id);
        if (!recurso) return res.status(404).json({ erro: 'Recurso não encontrado' });

        if (req.user.role !== 'admin' && req.user.id !== recurso.produtor.toString()) {
            return res.status(403).json({ erro: 'Sem permissão' });
        }

        const atualizado = await Recurso.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(atualizado);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// DELETE /recursos/:id — apagar (admin ou produtor dono)
router.delete('/:id', authenticate, async (req, res) => {
    try {
        const recurso = await Recurso.findById(req.params.id);
        if (!recurso) return res.status(404).json({ erro: 'Recurso não encontrado' });

        if (req.user.role !== 'admin' && req.user.id !== recurso.produtor.toString()) {
            return res.status(403).json({ erro: 'Sem permissão' });
        }

        await Recurso.findByIdAndDelete(req.params.id);
        res.json({ mensagem: 'Recurso eliminado' });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// PATCH /recursos/:id/rate — avaliar (autenticado)
router.patch('/:id/rate', authenticate, async (req, res) => {
    try {
        const { estrelas } = req.body;
        if (!estrelas || estrelas < 1 || estrelas > 5)
            return res.status(400).json({ erro: 'Estrelas deve ser entre 1 e 5' });

        const recurso = await Recurso.findById(req.params.id);
        if (!recurso) return res.status(404).json({ erro: 'Recurso não encontrado' });

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
});

module.exports = router;