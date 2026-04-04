const express = require('express');
const router = express.Router();
const Post = require('../models/post');

// GET /posts - listar todos os posts
router.get('/', async (req, res) => {
    try {
        // filtrar por recurso ex: /posts?recurso=id
        let query = {};
        if (req.query.recurso) query.recurso = req.query.recurso;

        const posts = await Post.find(query)
                                .populate('autor', 'nome email')
                                .populate('recurso', 'titulo')
                                .populate('comentarios.autor', 'nome email');
        res.json(posts);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET /posts/:id - ver um post
router.get('/:id', async (req, res) => {
    try {
        const post = await Post.findById(req.params.id)
                               .populate('autor', 'nome email')
                               .populate('recurso', 'titulo')
                               .populate('comentarios.autor', 'nome email');
        if (!post) return res.status(404).json({ error: 'Não encontrado' });
        res.json(post);
    } catch (err) {
        res.status(400).json({ error: 'ID inválido' });
    }
});

// POST /posts - criar post
router.post('/', async (req, res) => {
    try {
        const post = new Post(req.body);
        const saved = await post.save();
        res.status(201).json(saved);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// PUT /posts/:id - editar post
router.put('/:id', async (req, res) => {
    try {
        const updated = await Post.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updated) return res.status(404).json({ error: 'Não encontrado' });
        res.json(updated);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// DELETE /posts/:id - apagar post
router.delete('/:id', async (req, res) => {
    try {
        const deleted = await Post.findByIdAndDelete(req.params.id);
        if (!deleted) return res.status(404).json({ error: 'Não encontrado' });
        res.json({ message: 'Eliminado com sucesso', id: req.params.id });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /posts/:id/comentarios - adicionar comentário
router.post('/:id/comentarios', async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ error: 'Não encontrado' });
        post.comentarios.push(req.body);
        await post.save();
        res.status(201).json(post);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// DELETE /posts/:id/comentarios/:cid - apagar comentário
router.delete('/:id/comentarios/:cid', async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ error: 'Post não encontrado' });
        post.comentarios = post.comentarios.filter(c => c._id.toString() !== req.params.cid);
        await post.save();
        res.json({ message: 'Comentário eliminado' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;