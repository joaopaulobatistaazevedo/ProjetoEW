const express = require('express');
const router = express.Router();
const Post = require('../models/post');
const { authenticate, authorize } = require('../middleware/auth');

// GET /posts — público
router.get('/', async (req, res) => {
    try {
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

// GET /posts/:id — público
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

// POST /posts — autenticado
router.post('/', authenticate, async (req, res) => {
    try {
        const post = new Post({ ...req.body, autor: req.user.id });
        const saved = await post.save();
        res.status(201).json(saved);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// PUT /posts/:id — autor ou admin
router.put('/:id', authenticate, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ error: 'Não encontrado' });

        if (req.user.role !== 'admin' && req.user.id !== post.autor.toString()) {
            return res.status(403).json({ error: 'Sem permissão' });
        }

        const updated = await Post.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json(updated);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// DELETE /posts/:id — autor ou admin
router.delete('/:id', authenticate, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ error: 'Não encontrado' });

        if (req.user.role !== 'admin' && req.user.id !== post.autor.toString()) {
            return res.status(403).json({ error: 'Sem permissão' });
        }

        await Post.findByIdAndDelete(req.params.id);
        res.json({ message: 'Eliminado com sucesso' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// POST /posts/:id/comentarios — autenticado
router.post('/:id/comentarios', authenticate, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ error: 'Não encontrado' });
        post.comentarios.push({ ...req.body, autor: req.user.id });
        await post.save();
        res.status(201).json(post);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

// DELETE /posts/:id/comentarios/:cid — autor do comentário ou admin
router.delete('/:id/comentarios/:cid', authenticate, async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) return res.status(404).json({ error: 'Post não encontrado' });

        const comentario = post.comentarios.id(req.params.cid);
        if (!comentario) return res.status(404).json({ error: 'Comentário não encontrado' });

        if (req.user.role !== 'admin' && req.user.id !== comentario.autor.toString()) {
            return res.status(403).json({ error: 'Sem permissão' });
        }

        post.comentarios = post.comentarios.filter(c => c._id.toString() !== req.params.cid);
        await post.save();
        res.json({ message: 'Comentário eliminado' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;