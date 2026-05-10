var express = require('express');
var router = express.Router();
var axios = require('axios');

const API = process.env.API_URL || 'http://localhost:3001';
const COOKIE_NAME = process.env.COOKIE_NAME || 'auth_token_alunos';
const LIMITE_NOTICIAS_PAGINA = 20;
const DIAS_NOTICIAS_PAGINA = 3;

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
        const resposta = await axios.get(`${API}/noticias/latest`, {
            params: {
                limit: req.query.limit || LIMITE_NOTICIAS_PAGINA,
                dias: req.query.dias || DIAS_NOTICIAS_PAGINA
            }
        });
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
    const user = res.locals.user;
    if (!user || user.role !== 'admin') {
        return res.redirect('/noticias');
    }

    try {
        await axios.post(`${API}/noticias`, { ...req.body, tipo: 'admin' }, { headers: obterHeadersAutorizacao(req) });
        res.redirect('/noticias');
    } catch (err) {
        const erro = err.response?.data?.erro || err.message;
        res.status(err.response?.status || 500).render('noticias/form', {
            titulo: 'Nova Notícia',
            noticia: req.body,
            erro
        });
    }
});

module.exports = router;
