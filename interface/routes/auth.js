var express = require('express');
var router = express.Router();
var axios = require('axios');

const API = process.env.API_URL || 'http://localhost:3000';

// GET /auth/login
router.get('/login', (req, res) => {
    res.render('auth/login', { titulo: 'Login' });
});

// POST /auth/login
router.post('/login', async (req, res) => {
    try {
        const resposta = await axios.post(`${API}/auth/login`, req.body);
        const { token, utilizador } = resposta.data;

        res.cookie('token', token, { httpOnly: true });
        res.cookie('user', JSON.stringify(utilizador));
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
        await axios.post(`${API}/auth/registo`, req.body);
        res.redirect('/auth/login');
    } catch (err) {
        res.render('auth/registo', { titulo: 'Registo', erro: 'Erro ao criar conta' });
    }
});

// GET /auth/logout
router.get('/logout', (req, res) => {
    res.clearCookie('token');
    res.clearCookie('user');
    res.redirect('/');
});

module.exports = router;