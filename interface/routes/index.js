var express = require('express');
var router = express.Router();
var axios = require('axios');

// API base URL
const API = process.env.API_URL || 'http://localhost:3001';
const LIMITE_NOTICIAS_HOME = 5;
const DIAS_NOTICIAS_HOME = 3;

// Home: lista recursos publicos + top3
router.get('/', async (req, res) => {
    try {
        const recursosRes = await axios.get(`${API}/recursos?visibilidade=publico`);
        const top3Res = await axios.get(`${API}/recursos/top3`);
        const noticiasRes = await axios.get(`${API}/noticias/latest`, { params: { limit: LIMITE_NOTICIAS_HOME, dias: DIAS_NOTICIAS_HOME } });
        res.render('index', {
            titulo: 'Recursos Educativos',
            recursos: recursosRes.data.slice(0, 6),
            top3: top3Res.data,
            noticias: noticiasRes.data
        });
    } catch (err) {
        res.render('index', { titulo: 'Recursos Educativos', recursos: [], top3: [], noticias: [], erro: err.message });
    }
});

module.exports = router;
