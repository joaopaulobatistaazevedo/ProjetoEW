var express = require('express');
var router = express.Router();
var axios = require('axios');

const API = process.env.API_URL || 'http://localhost:3001';
const COOKIE_NAME = process.env.COOKIE_NAME || 'auth_token_alunos';

function obterToken(req) {
    return req.cookies[COOKIE_NAME];
}

function obterHeadersAutorizacao(req) {
    const token = obterToken(req);
    return token ? { Authorization: `Bearer ${token}` } : {};
}

// GET /noticias - lista publica
router.get('/', async (req, res) => {
    try {
        const resposta = await axios.get(`${API}/noticias`, { params: { limit: req.query.limit || 50 } });
        res.render('noticias/lista', { titulo: 'Notícias', noticias: resposta.data });
    } catch (err) {
        res.render('noticias/lista', { titulo: 'Notícias', noticias: [], erro: err.message });
    }
});

// GET /noticias/novo - formulario de criacao (admin)
router.get('/novo', (req, res) => {
    const user = res.locals.user;
    if (!user || user.role !== 'admin') {
        return res.redirect('/noticias');
    }
    res.render('noticias/form', { titulo: 'Nova Notícia', noticia: {} });
});

// POST /noticias/novo - criar noticia (formulario admin) -> encaminha para API
router.post('/novo', async (req, res) => {
    try {
        await axios.post(`${API}/noticias`, req.body, { headers: obterHeadersAutorizacao(req) });
        res.redirect('/noticias');
    } catch (err) {
        res.redirect('/noticias');
    }
});

module.exports = router;
