var express = require('express');
var router = express.Router();
var axios = require('axios');

const COOKIE_NAME = process.env.COOKIE_NAME || 'auth_token_alunos';
const AUTH        = process.env.AUTH_URL    || 'http://localhost:3002/users';

// GET /auth/login
router.get('/login', (req, res) => {
    res.render('auth/login', { titulo: 'Login' });
});

// POST /auth/login — envia credenciais ao auth service, guarda o token em cookie
router.post('/login', async (req, res) => {
    try {
        const resposta = await axios.post(`${AUTH}/login`, req.body);
        res.cookie(COOKIE_NAME, resposta.data.token, { httpOnly: true });
        res.redirect('/');
    } catch (err) {
        res.render('auth/login', { titulo: 'Login', erro: 'Credenciais inválidas' });
    }
});

// GET /auth/registo
router.get('/registo', (req, res) => {
    res.render('auth/registo', { titulo: 'Registo' });
});

// POST /auth/registo — cria conta no auth service
router.post('/registo', async (req, res) => {
    try {
        await axios.post(`${AUTH}/register`, req.body);
        res.redirect('/auth/login');
    } catch (err) {
        res.render('auth/registo', { titulo: 'Registo', erro: 'Erro ao criar conta' });
    }
});

// GET /auth/logout — limpa o cookie
router.get('/logout', (req, res) => {
    res.clearCookie(COOKIE_NAME);
    res.redirect('/');
});

module.exports = router;