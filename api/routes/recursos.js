const express = require('express');
const router = express.Router();
const Recurso = require('../models/recurso');

// GET /recursos - listar todos os recursos públicos
router.get('/', async (req, res) => {
    try {
        let query = { visibilidade: 'publico' };

        // filtrar por tipo ex: /recursos?tipo=artigo
        if (req.query.tipo) query.tipo = req.query.tipo;

        // filtrar por hashtag ex: /recursos?hashtag=python
        if (req.query.hashtag) query.hashtags = req.query.hashtag;

        const recursos = await Recurso.find(query)
                                      .populate('produtor', 'nome email');
        res.json(recursos);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /recursos/:id - ver um recurso pelo id
router.get('/:id', async (req, res) => {
    try {
        const recurso = await Recurso.findById(req.params.id)
                                     .populate('produtor', 'nome email');
        if (!recurso) return res.status(404).json({ error: 'Não encontrado' });
        res.json(recurso);
    } catch (err) {
        res.status(400).json({ error: 'ID inválido' });
    }
});

// POST /recursos - criar novo recurso
router.post('/', async (req, res) => {
    try {
        const recurso = new Recurso(req.body);
        const saved = await recurso.save();
        res.status(201).json(saved);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// PUT /recursos/:id - editar recurso
router.put('/:id', async (req, res) => {
    try {
        const updated = await Recurso.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updated) return res.status(404).json({ error: 'Não encontrado' });
        res.json(updated);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// DELETE /recursos/:id - apagar recurso
router.delete('/:id', async (req, res) => {
    try {
        const deleted = await Recurso.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ error: 'Não encontrado' });
        res.json({ message: 'Eliminado com sucesso', id: req.params.id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /recursos/:id/rating - dar estrelas a um recurso
router.post('/:id/rating', async (req, res) => {
    try {
        const { estrelas } = req.body; // valor entre 1 e 5
        if (!estrelas || estrelas < 1 || estrelas > 5)
            return res.status(400).json({ error: 'Estrelas deve ser entre 1 e 5' });

        const recurso = await Recurso.findById(req.params.id);
        if (!recurso) return res.status(404).json({ error: 'Não encontrado' });

        // média simples entre o rating atual e o novo
        recurso.rating = ((recurso.rating + estrelas) / 2).toFixed(1);
        await recurso.save();
        res.json({ rating: recurso.rating });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;