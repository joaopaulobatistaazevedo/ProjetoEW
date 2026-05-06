var express = require('express');
var router = express.Router();
var axios = require('axios');

const AUTH        = process.env.AUTH_URL    || 'http://localhost:3002/users';
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
        const isSelf = req.user && req.user.sub === req.params.id;
        const isAdmin = req.user && req.user.role === 'admin';

        if (!isSelf && !isAdmin) {
            return res.status(403).render('erro', {
                titulo: 'Sem permissao',
                mensagem: 'Nao tem permissao para editar este utilizador.'
            });
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
        res.redirect('/utilizadores');
    } catch (err) {
        res.render('erro', { titulo: 'Erro', mensagem: 'Erro ao atualizar utilizador' });
    }
});

// POST /utilizadores/:id/apagar — remover
router.post('/:id/apagar', async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).render('erro', {
                titulo: 'Sem permissao',
                mensagem: 'Apenas administradores podem apagar utilizadores.'
            });
        }

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
        if (!req.user || req.user.role !== 'admin') {
            return res.status(403).render('erro', {
                titulo: 'Sem permissao',
                mensagem: 'Apenas administradores podem promover utilizadores a admin.'
            });
        }

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