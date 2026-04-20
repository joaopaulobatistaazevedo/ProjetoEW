var express = require('express');
var router = express.Router();
var axios = require('axios');

const API = process.env.API_URL || 'http://localhost:3000';

// POST /posts — criar post (vem do form na página do recurso)
router.post('/', async (req, res) => {
    try {
        const token = req.cookies.token;
        await axios.post(`${API}/posts`, req.body, {
            headers: { Authorization: `Bearer ${token}` }
        });
        res.redirect(`/recursos/${req.body.recurso}`);
    } catch (err) {
        res.redirect('back');
    }
});

// POST /posts/:id/comentarios
router.post('/:id/comentarios', async (req, res) => {
    try {
        const token = req.cookies.token;
        await axios.post(`${API}/posts/${req.params.id}/comentarios`, req.body, {
            headers: { Authorization: `Bearer ${token}` }
        });
        res.redirect('back');
    } catch (err) {
        res.redirect('back');
    }
});

// POST /posts/:id/apagar
router.post('/:id/apagar', async (req, res) => {
    try {
        const token = req.cookies.token;
        const recursoId = req.body.recurso;
        await axios.delete(`${API}/posts/${req.params.id}`, {
            headers: { Authorization: `Bearer ${token}` }
        });
        res.redirect(`/recursos/${recursoId}`);
    } catch (err) {
        res.redirect('back');
    }
});

module.exports = router;