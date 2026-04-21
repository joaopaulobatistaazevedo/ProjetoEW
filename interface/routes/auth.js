var express = require('express');
var router = express.Router();
var axios = require('axios');

const COOKIE_NAME = process.env.COOKIE_NAME || 'token';

const AUTH = process.env.AUTH_URL || 'http://auth:2623/users';

// GET /auth/login
router.get('/login', (req, res) => {
    res.render('auth/login', { titulo: 'Login' });
});

// POST /auth/login
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

// POST /auth/registo
router.post('/registo', async (req, res) => {
    try {
        await axios.post(`${AUTH}/register`, req.body);
        res.redirect('/auth/login');
    } catch (err) {
        res.render('auth/registo', { titulo: 'Registo', erro: 'Erro ao criar conta' });
    }
});

// GET /auth/logout
router.get('/logout', (req, res) => {
    res.clearCookie(COOKIE_NAME);
    res.clearCookie('user');
    res.redirect('/');
});

module.exports = router;