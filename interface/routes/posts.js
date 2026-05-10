var express = require('express');
var router = express.Router();
var axios = require('axios');
const { obterHeadersAutorizacao } = require('./utils');

const API         = process.env.API_URL     || 'http://localhost:3001';

function obterDestinoRecurso(req) {
    return req.body && req.body.recurso ? `/recursos/${req.body.recurso}` : '/recursos';
}

// POST /posts — criar post (forward token)
router.post('/', async (req, res) => {
    try {
        await axios.post(`${API}/posts`, req.body, {
            headers: obterHeadersAutorizacao(req)
        });
        res.redirect(obterDestinoRecurso(req));
    } catch (err) {
        res.redirect(obterDestinoRecurso(req));
    }
});

// POST /posts/:id/comentarios — adicionar comentario
router.post('/:id/comentarios', async (req, res) => {
    try {
        await axios.post(`${API}/posts/${req.params.id}/comentarios`, req.body, {
            headers: obterHeadersAutorizacao(req)
        });
        res.redirect(obterDestinoRecurso(req));
    } catch (err) {
        res.redirect(obterDestinoRecurso(req));
    }
});

// POST /posts/:id/apagar — remover post
router.post('/:id/apagar', async (req, res) => {
    try {
        const recursoId = req.body.recurso;
        await axios.delete(`${API}/posts/${req.params.id}`, {
            headers: obterHeadersAutorizacao(req)
        });
        res.redirect(recursoId ? `/recursos/${recursoId}` : '/recursos');
    } catch (err) {
        res.redirect(obterDestinoRecurso(req));
    }
});

module.exports = router;
