var express = require('express');
var router = express.Router();
var axios = require('axios');

const API = process.env.API_URL || 'http://localhost:3001';

// GET /utilizadores — painel admin
router.get('/', async (req, res) => {
    try {
        const token = req.cookies.token;
        const resposta = await axios.get(`${API}/utilizadores`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        res.render('utilizadores/lista', { titulo: 'Utilizadores', utilizadores: resposta.data });
    } catch (err) {
        res.render('erro', { titulo: 'Erro', mensagem: 'Sem permissão ou erro ao carregar' });
    }
});

module.exports = router;