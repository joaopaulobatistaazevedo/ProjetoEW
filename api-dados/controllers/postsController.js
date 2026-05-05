const Post = require('../models/post');

const postsController = {

    // GET /posts — público
    getAllPosts: async (req, res) => {
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
    },

    // GET /posts/:id — público
    getPostById: async (req, res) => {
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
    },

    // POST /posts — autenticado
    createPost: async (req, res) => {
        try {
            const { recurso: recursoId, conteudo, titulo } = req.body;
            if (!conteudo || conteudo.trim().length < 2) return res.status(400).json({ error: 'Conteúdo inválido' });

            // Se associado a recurso, validar existencia e visibilidade
            if (recursoId) {
                const Recurso = require('../models/recurso');
                const recurso = await Recurso.findById(recursoId);
                if (!recurso) return res.status(400).json({ error: 'Recurso associado não encontrado' });
                if (recurso.visibilidade === 'privado' && req.user.role !== 'admin' && req.user.id !== recurso.autor.toString()) {
                    return res.status(403).json({ error: 'Sem permissão para postar neste recurso' });
                }
            }

            const post = new Post({ titulo, conteudo, recurso: recursoId, autor: req.user.id });
            const saved = await post.save();
            res.status(201).json(saved);
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    },

    // PUT /posts/:id — autor ou admin
    updatePost: async (req, res) => {
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
    },

    // DELETE /posts/:id — autor ou admin
    deletePost: async (req, res) => {
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
    },

    // POST /posts/:id/comentarios — autenticado
    createComentario: async (req, res) => {
        try {
            const post = await Post.findById(req.params.id);
            if (!post) return res.status(404).json({ error: 'Não encontrado' });
            const { conteudo } = req.body;
            if (!conteudo || conteudo.trim().length < 1) return res.status(400).json({ error: 'Comentário inválido' });
            post.comentarios.push({ conteudo, autor: req.user.id });
            await post.save();
            res.status(201).json(post);
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    },

    // DELETE /posts/:id/comentarios/:cid — autor do comentário ou admin
    deleteComentario: async (req, res) => {
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
    }
};

module.exports = postsController;