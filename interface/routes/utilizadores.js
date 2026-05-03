var express = require('express');
var router = express.Router();
var axios = require('axios');

const AUTH        = process.env.AUTH_URL    || 'http://localhost:2623/users';
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
        res.render('erro', { titulo: 'Erro', mensagem: 'Sem permissão ou erro ao carregar' });
    }
});

// GET /utilizadores/:id — ver um utilizador
router.get('/:id', async (req, res) => {
    try {
        const token = req.cookies[COOKIE_NAME];
        const resposta = await axios.get(`${AUTH}/${req.params.id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        res.render('utilizadores/detalhe', { titulo: 'Utilizador', utilizador: resposta.data });
    } catch (err) {
        res.render('erro', { titulo: 'Erro', mensagem: 'Utilizador não encontrado' });
    }
});

// POST /utilizadores/:id/editar — atualizar
router.post('/:id/editar', async (req, res) => {
    try {
        const token = req.cookies[COOKIE_NAME];
        const dados = { ...req.body };
        if (dados.password === '') {
            delete dados.password;
        }
        await axios.put(`${AUTH}/${req.params.id}`, dados, {
            headers: { Authorization: `Bearer ${token}` }
        });
        res.redirect('/utilizadores');
    } catch (err) {
        res.render('erro', { titulo: 'Erro', mensagem: 'Erro ao atualizar utilizador' });
    }
});

// POST /utilizadores/:id/apagar — remover
router.post('/:id/apagar', async (req, res) => {
    try {
        const token = req.cookies[COOKIE_NAME];
        await axios.delete(`${AUTH}/${req.params.id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        res.redirect('/utilizadores');
    } catch (err) {
        res.render('erro', { titulo: 'Erro', mensagem: 'Erro ao apagar utilizador' });
    }
});

// POST /utilizadores/:id/promover/admin — promover a admin
router.post('/:id/promover/admin', async (req, res) => {
    try {
        const token = req.cookies[COOKIE_NAME];
        await axios.put(`${AUTH}/${req.params.id}/promote/admin`, {}, {
            headers: { Authorization: `Bearer ${token}` }
        });
        res.redirect(`/utilizadores/${req.params.id}`);
    } catch (err) {
        res.render('erro', { titulo: 'Erro', mensagem: 'Erro ao promover utilizador a admin' });
    }
});

module.exports = router;