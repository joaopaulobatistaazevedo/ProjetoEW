var express = require('express');
var router = express.Router();
var axios = require('axios');

const AUTH        = process.env.AUTH_URL    || 'http://localhost:3002/users';
const API         = process.env.API_URL     || 'http://localhost:3001';
const COOKIE_NAME = process.env.COOKIE_NAME || 'auth_token_alunos';

// GET /utilizadores — listar todos (via auth service)
router.get('/', async (req, res) => {
    try {
        const token = req.cookies[COOKIE_NAME];
        const resposta = await axios.get(`${AUTH}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        res.render('utilizadores/lista', { titulo: 'Utilizadores', utilizadores: resposta.data });
    } catch (err) {
        res.redirect('/');
    }
});

// GET /utilizadores/:id — ver um utilizador
router.get('/:id', async (req, res) => {
    try {
        const token = req.cookies[COOKIE_NAME];
        const resposta = await axios.get(`${AUTH}/${req.params.id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const filtrosRecursos = { autor: req.params.id };
        const podeVerPrivados = req.user && (
            req.user.role === 'admin' ||
            String(req.user.sub || req.user.id) === String(req.params.id)
        );

        if (!podeVerPrivados) {
            filtrosRecursos.visibilidade = 'publico';
        }

        let recursos = [];
        try {
            const recursosRes = await axios.get(`${API}/recursos`, {
                params: filtrosRecursos
            });
            recursos = recursosRes.data || [];
        } catch (recursosErr) {
            recursos = [];
        }

        res.render('utilizadores/detalhe', {
            titulo: 'Utilizador',
            utilizador: resposta.data,
            recursos
        });
    } catch (err) {
        res.redirect('/utilizadores');
    }
});

// POST /utilizadores/:id/editar — atualizar
router.post('/:id/editar', async (req, res) => {
    try {
        const isSelf = req.user && req.user.sub === req.params.id;
        const isAdmin = req.user && req.user.role === 'admin';

        if (!isSelf && !isAdmin) {
            return res.redirect(`/utilizadores/${req.params.id}`);
        }

        const token = req.cookies[COOKIE_NAME];
        const dados = { ...req.body };

        // A interface nao permite alterar passwords por este formulario.
        delete dados.password;

        // Apenas administradores podem alterar role de outros utilizadores.
        if (!isAdmin) {
            delete dados.role;
        }

        await axios.put(`${AUTH}/${req.params.id}`, dados, {
            headers: { Authorization: `Bearer ${token}` }
        });
        res.redirect(`/utilizadores/${req.params.id}`);
    } catch (err) {
        res.redirect(`/utilizadores/${req.params.id}`);
    }
});

// POST /utilizadores/:id/apagar — remover
router.post('/:id/apagar', async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'admin') {
            return res.redirect(`/utilizadores/${req.params.id}`);
        }

        const token = req.cookies[COOKIE_NAME];
        await axios.delete(`${AUTH}/${req.params.id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        res.redirect('/utilizadores');
    } catch (err) {
        res.redirect(`/utilizadores/${req.params.id}`);
    }
});

// POST /utilizadores/:id/promover/admin — promover a admin
router.post('/:id/promover/admin', async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'admin') {
            return res.redirect(`/utilizadores/${req.params.id}`);
        }

        const token = req.cookies[COOKIE_NAME];
        await axios.put(`${AUTH}/${req.params.id}/promote/admin`, {}, {
            headers: { Authorization: `Bearer ${token}` }
        });
        res.redirect(`/utilizadores/${req.params.id}`);
    } catch (err) {
        res.redirect(`/utilizadores/${req.params.id}`);
    }
});

module.exports = router;
