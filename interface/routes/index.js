var express = require('express');
var router = express.Router();
var axios = require('axios');

const API = process.env.API_URL || 'http://localhost:3001';

router.get('/', async (req, res) => {
    try {
        const [recursosRes, top3Res] = await Promise.all([
            axios.get(`${API}/recursos?visibilidade=publico`),
            axios.get(`${API}/recursos/top3`)
        ]);

        res.render('index', {
            titulo: 'Recursos Educativos',
            recursos: recursosRes.data.slice(0, 6), // últimos 6
            top3: top3Res.data
        });
    } catch (err) {
        res.render('index', { titulo: 'Recursos Educativos', recursos: [], top3: [], erro: err.message });
    }
});

module.exports = router;