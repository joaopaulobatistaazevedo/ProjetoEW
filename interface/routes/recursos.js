var express = require('express');
var router = express.Router();
var axios = require('axios');

const API         = process.env.API_URL     || 'http://localhost:3001';
const COOKIE_NAME = process.env.COOKIE_NAME || 'auth_token_alunos';

// GET /recursos — listagem com filtros
router.get('/', async (req, res) => {
    try {
        const params = new URLSearchParams(req.query).toString();
        const resposta = await axios.get(`${API}/recursos?${params}`);
        res.render('recursos/lista', { titulo: 'Recursos', recursos: resposta.data, filtros: req.query });
    } catch (err) {
        res.render('recursos/lista', { titulo: 'Recursos', recursos: [], filtros: {}, erro: err.message });
    }
});

// GET /recursos/novo — formulário de criação
router.get('/novo', (req, res) => {
    res.render('recursos/form', { titulo: 'Submeter Recurso', recurso: null });
});

// POST /recursos/novo — submeter recurso
router.post('/novo', async (req, res) => {
    try {
        const token = req.cookies[COOKIE_NAME];
        await axios.post(`${API}/recursos`, req.body, {
            headers: { Authorization: `Bearer ${token}` }
        });
        res.redirect('/recursos');
    } catch (err) {
        res.render('recursos/form', { titulo: 'Submeter Recurso', recurso: null, erro: err.message });
    }
});

// GET /recursos/:id — detalhe
router.get('/:id', async (req, res) => {
    try {
        const [recursoRes, postsRes] = await Promise.all([
            axios.get(`${API}/recursos/${req.params.id}`),
            axios.get(`${API}/posts?recurso=${req.params.id}`)
        ]);
        res.render('recursos/detalhe', {
            titulo: recursoRes.data.titulo,
            recurso: recursoRes.data,
            posts: postsRes.data
        });
    } catch (err) {
        res.status(404).render('erro', { titulo: 'Erro', mensagem: 'Recurso não encontrado' });
    }
});

// GET /recursos/:id/editar
router.get('/:id/editar', async (req, res) => {
    try {
        const resposta = await axios.get(`${API}/recursos/${req.params.id}`);
        res.render('recursos/form', { titulo: 'Editar Recurso', recurso: resposta.data });
    } catch (err) {
        res.redirect('/recursos');
    }
});

// POST /recursos/:id/editar
router.post('/:id/editar', async (req, res) => {
    try {
        const token = req.cookies[COOKIE_NAME];
        await axios.put(`${API}/recursos/${req.params.id}`, req.body, {
            headers: { Authorization: `Bearer ${token}` }
        });
        res.redirect(`/recursos/${req.params.id}`);
    } catch (err) {
        res.redirect('/recursos');
    }
});

// POST /recursos/:id/apagar
router.post('/:id/apagar', async (req, res) => {
    try {
        const token = req.cookies[COOKIE_NAME];
        await axios.delete(`${API}/recursos/${req.params.id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        res.redirect('/recursos');
    } catch (err) {
        res.redirect('/recursos');
    }
});

module.exports = router;