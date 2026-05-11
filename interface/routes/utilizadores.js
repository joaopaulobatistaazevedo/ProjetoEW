var express = require('express');
var router = express.Router();
var axios = require('axios');
const { obterHeadersAutorizacao } = require('./utils');

const AUTH        = process.env.AUTH_URL    || 'http://localhost:3002/users';
const API         = process.env.API_URL     || 'http://localhost:3001';

// GET /utilizadores — listar todos (via auth service)
router.get('/', async (req, res) => {
    try {
        const resposta = await axios.get(`${AUTH}`, {
            headers: obterHeadersAutorizacao(req)
        });
        res.render('utilizadores/lista', { titulo: 'Utilizadores', utilizadores: resposta.data });
    } catch (err) {
        res.redirect('/');
    }
});

// GET /utilizadores/:id — ver um utilizador
router.get('/:id', async (req, res) => {
    try {
        const resposta = await axios.get(`${AUTH}/${req.params.id}`, {
            headers: obterHeadersAutorizacao(req)
        });

        const filtrosRecursos = { autor: req.params.id };
        const podeVerPrivados = req.user && (
            req.user.role === 'admin' ||
            String(req.user.sub || req.user.id) === String(req.params.id)
        );

        if (!podeVerPrivados) {
            filtrosRecursos.visibilidade = 'publico';
        }

        let recursos = [];
        try {
            const recursosRes = await axios.get(`${API}/recursos`, {
                params: filtrosRecursos
            });
            recursos = recursosRes.data || [];
        } catch (recursosErr) {
            recursos = [];
        }

        res.render('utilizadores/detalhe', {
            titulo: 'Utilizador',
            utilizador: resposta.data,
            recursos
        });
    } catch (err) {
        res.redirect('/utilizadores');
    }
});

// GET /utilizadores/:id/recursos/download — exportar recursos visiveis do utilizador
router.get('/:id/recursos/download', async (req, res) => {
    try {
        const filtrosRecursos = { autor: req.params.id, limit: 10000 };

        if (!req.user || req.user.role !== 'admin') {
            filtrosRecursos.visibilidade = 'publico';
        }

        const recursosRes = await axios.get(`${API}/recursos`, {
            params: filtrosRecursos
        });

        const ids = (recursosRes.data || [])
            .map(recurso => recurso._id)
            .filter(Boolean);

        if (ids.length === 0) {
            return res.status(404).render('erro', {
                titulo: 'Sem recursos para exportar',
                mensagem: req.user && req.user.role === 'admin'
                    ? 'Este utilizador ainda não publicou recursos.'
                    : 'Este utilizador não tem recursos públicos para exportar.',
                linkVoltar: `/utilizadores/${req.params.id}`,
                botaoVolta: 'Voltar ao Utilizador'
            });
        }

        const resposta = await axios.get(`${API}/disseminacao/recursos/exportar-multiplos`, {
            params: { ids: ids.join(',') },
            headers: obterHeadersAutorizacao(req),
            responseType: 'arraybuffer'
        });

        ['content-type', 'content-disposition', 'content-length', 'x-resources-count'].forEach(nome => {
            if (resposta.headers[nome]) {
                res.setHeader(nome, resposta.headers[nome]);
            }
        });

        if (!res.getHeader('Content-Disposition')) {
            res.setHeader('Content-Disposition', `attachment; filename="recursos-utilizador-${req.params.id}-${Date.now()}.zip"`);
        }

        res.send(Buffer.from(resposta.data));
    } catch (err) {
        res.status(err.response?.status || 500).render('erro', {
            titulo: 'Erro ao exportar recursos',
            mensagem: 'Não foi possível exportar os recursos deste utilizador.',
            linkVoltar: `/utilizadores/${req.params.id}`,
            botaoVolta: 'Voltar ao Utilizador'
        });
    }
});

// POST /utilizadores/:id/editar — atualizar
router.post('/:id/editar', async (req, res) => {
    try {
        const isSelf = req.user && req.user.sub === req.params.id;
        const isAdmin = req.user && req.user.role === 'admin';

        if (!isSelf && !isAdmin) {
            return res.redirect(`/utilizadores/${req.params.id}`);
        }

        const dados = { ...req.body };

        // A interface nao permite alterar passwords por este formulario.
        delete dados.password;

        // Apenas administradores podem alterar role de outros utilizadores.
        if (!isAdmin) {
            delete dados.role;
        }

        await axios.put(`${AUTH}/${req.params.id}`, dados, {
            headers: obterHeadersAutorizacao(req)
        });
        res.redirect(`/utilizadores/${req.params.id}`);
    } catch (err) {
        res.redirect(`/utilizadores/${req.params.id}`);
    }
});

// POST /utilizadores/:id/apagar — remover
router.post('/:id/apagar', async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'admin') {
            return res.redirect(`/utilizadores/${req.params.id}`);
        }

        await axios.delete(`${AUTH}/${req.params.id}`, {
            headers: obterHeadersAutorizacao(req)
        });
        res.redirect('/utilizadores');
    } catch (err) {
        res.redirect(`/utilizadores/${req.params.id}`);
    }
});

// POST /utilizadores/:id/promover/admin — promover a admin
router.post('/:id/promover/admin', async (req, res) => {
    try {
        if (!req.user || req.user.role !== 'admin') {
            return res.redirect(`/utilizadores/${req.params.id}`);
        }

        await axios.put(`${AUTH}/${req.params.id}/promote/admin`, {}, {
            headers: obterHeadersAutorizacao(req)
        });
        res.redirect(`/utilizadores/${req.params.id}`);
    } catch (err) {
        res.redirect(`/utilizadores/${req.params.id}`);
    }
});

module.exports = router;
