const express = require('express');
const path = require('path');
const Recurso = require('../models/recurso');
const upload = require('../middleware/upload');
// const { authenticate, authorize } = require('../middleware/auth'); // descomentar na Fase 1

const router = express.Router();

// GET /recursos — listar com filtros
router.get('/', async (req, res) => {
    try {
        const { tipo, hashtag, ano, visibilidade } = req.query;
        const filtro = {};

        if (tipo)        filtro.tipo = tipo;
        if (visibilidade) filtro.visibilidade = visibilidade;
        if (hashtag)     filtro.hashtags = hashtag;
        if (ano)         filtro.dataCriacao = {
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

// GET /recursos/top3 — top 3 por média de estrelas
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

// GET /recursos/:id — detalhe de um recurso
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

// GET /recursos/:id/download — descarregar ficheiro
router.get('/:id/download', async (req, res) => {
    try {
        const recurso = await Recurso.findById(req.params.id);
        if (!recurso) return res.status(404).json({ erro: 'Recurso não encontrado' });
        if (!recurso.ficheiro) return res.status(404).json({ erro: 'Sem ficheiro associado' });

        // TODO: verificar visibilidade quando auth estiver implementada
        // if (recurso.visibilidade === 'privado' && req.user?.role !== 'admin') ...

        res.download(path.resolve(recurso.ficheiro));
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// POST /recursos — criar recurso com upload de ficheiro
router.post('/', upload.single('ficheiro'), async (req, res) => {
    try {
        const { titulo, subtitulo, tipo, dataCriacao, visibilidade, hashtags, produtor } = req.body;

        const recurso = await Recurso.create({
            titulo,
            subtitulo,
            tipo,
            dataCriacao,
            visibilidade,
            hashtags: hashtags ? JSON.parse(hashtags) : [],
            produtor, // TODO: substituir por req.user.id quando auth estiver ativa
            ficheiro: req.file ? req.file.path : null
        });

        res.status(201).json(recurso);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// PUT /recursos/:id — editar recurso
router.put('/:id', async (req, res) => {
    try {
        const recurso = await Recurso.findById(req.params.id);
        if (!recurso) return res.status(404).json({ erro: 'Recurso não encontrado' });

        // TODO: verificar se req.user.id === recurso.produtor ou role === 'admin'

        const atualizado = await Recurso.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(atualizado);
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// DELETE /recursos/:id — eliminar recurso
router.delete('/:id', async (req, res) => {
    try {
        const recurso = await Recurso.findById(req.params.id);
        if (!recurso) return res.status(404).json({ erro: 'Recurso não encontrado' });

        // TODO: verificar se req.user.id === recurso.produtor ou role === 'admin'

        await Recurso.findByIdAndDelete(req.params.id);
        res.json({ mensagem: 'Recurso eliminado' });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// PATCH /recursos/:id/rate — avaliar recurso
router.patch('/:id/rate', async (req, res) => {
    try {
        const { estrelas, utilizadorId } = req.body; // TODO: utilizadorId virá de req.user.id
        if (!estrelas || estrelas < 1 || estrelas > 5)
            return res.status(400).json({ erro: 'Estrelas deve ser entre 1 e 5' });

        const recurso = await Recurso.findById(req.params.id);
        if (!recurso) return res.status(404).json({ erro: 'Recurso não encontrado' });

        // Upsert — atualiza se já votou, adiciona se não votou
        const indice = recurso.ratings.findIndex(r => r.utilizador.toString() === utilizadorId);
        if (indice >= 0) {
            recurso.ratings[indice].estrelas = estrelas;
        } else {
            recurso.ratings.push({ utilizador: utilizadorId, estrelas });
        }

        await recurso.save(); // pre-save hook recalcula mediaEstrelas
        res.json({ mediaEstrelas: recurso.mediaEstrelas, totalVotos: recurso.ratings.length });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

module.exports = router;