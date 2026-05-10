var express = require('express');
var router = express.Router();
var axios = require('axios');

const API         = process.env.API_URL     || 'http://localhost:3001';
const COOKIE_NAME = process.env.COOKIE_NAME || 'auth_token_alunos';

function obterDestinoRecurso(req) {
    return req.body && req.body.recurso ? `/recursos/${req.body.recurso}` : '/recursos';
}

// POST /posts — criar post (forward token)
router.post('/', async (req, res) => {
    try {
        const token = req.cookies[COOKIE_NAME];
        await axios.post(`${API}/posts`, req.body, {
            headers: { Authorization: `Bearer ${token}` }
        });
        res.redirect(obterDestinoRecurso(req));
    } catch (err) {
        res.redirect(obterDestinoRecurso(req));
    }
});

// POST /posts/:id/comentarios — adicionar comentario
router.post('/:id/comentarios', async (req, res) => {
    try {
        const token = req.cookies[COOKIE_NAME];
        await axios.post(`${API}/posts/${req.params.id}/comentarios`, req.body, {
            headers: { Authorization: `Bearer ${token}` }
        });
        res.redirect(obterDestinoRecurso(req));
    } catch (err) {
        res.redirect(obterDestinoRecurso(req));
    }
});

// POST /posts/:id/apagar — remover post
router.post('/:id/apagar', async (req, res) => {
    try {
        const token = req.cookies[COOKIE_NAME];
        const recursoId = req.body.recurso;
        await axios.delete(`${API}/posts/${req.params.id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        res.redirect(recursoId ? `/recursos/${recursoId}` : '/recursos');
    } catch (err) {
        res.redirect(obterDestinoRecurso(req));
    }
});

module.exports = router;
