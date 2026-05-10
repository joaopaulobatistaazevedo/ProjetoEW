var express = require('express');
var router = express.Router();
var axios = require('axios');
const {
    obterHeadersAutorizacao,
    utilizadorEhAdmin,
    obterMensagemErroAPI,
    enviarJSONDownload
} = require('./utils');

const API = process.env.API_URL || 'http://localhost:3001';
const AUTH = process.env.AUTH_URL || 'http://localhost:3002/users';

function garantirAdmin(req, res) {
    if (utilizadorEhAdmin(req)) return true;
    res.redirect('/recursos');
    return false;
}

async function obterTodosRecursos() {
    const resposta = await axios.get(`${API}/recursos`, {
        params: { limit: 10000 }
    });

    return resposta.data || [];
}

async function obterTodosTiposAdmin(req) {
    const resposta = await axios.get(`${API}/tipos-recurso/todos`, {
        headers: obterHeadersAutorizacao(req)
    });
    return resposta.data;
}

function renderErro(res, err, fallback) {
    res.status(err.response?.status || 500).render('recursos/exportacao', {
        titulo: 'Exportação de Dados',
        erro: obterMensagemErroAPI(err, fallback)
    });
}

router.get('/', async (req, res) => {
    if (!garantirAdmin(req, res)) return;

    res.render('recursos/admin', {
        titulo: 'Administração'
    });
});

router.get('/tiposrecursos', async (req, res) => {
    if (!garantirAdmin(req, res)) return;

    try {
        const tiposRecurso = await obterTodosTiposAdmin(req);
        res.render('recursos/tipos', {
            titulo: 'Tipos de Recurso',
            tiposRecurso,
            formData: {},
            sucesso: req.query.sucesso
        });
    } catch (err) {
        res.status(err.response?.status || 500).render('erro', {
            titulo: 'Erro',
            mensagem: obterMensagemErroAPI(err, 'Nao foi possivel carregar a gestao de tipos de recurso.')
        });
    }
});

router.post('/tiposrecursos/novo', async (req, res) => {
    if (!garantirAdmin(req, res)) return;

    try {
        await axios.post(`${API}/tipos-recurso`, req.body, {
            headers: obterHeadersAutorizacao(req)
        });

        res.redirect('/admin/tiposrecursos?sucesso=tipo-criado');
    } catch (err) {
        let tiposRecurso = [];

        try {
            tiposRecurso = await obterTodosTiposAdmin(req);
        } catch (tiposErr) {
            tiposRecurso = [];
        }

        res.status(err.response?.status || 500).render('recursos/tipos', {
            titulo: 'Tipos de Recurso',
            tiposRecurso,
            formData: req.body,
            erro: obterMensagemErroAPI(err, 'Nao foi possivel criar o tipo de recurso.')
        });
    }
});

router.post('/tiposrecursos/:id/estado', async (req, res) => {
    if (!garantirAdmin(req, res)) return;

    try {
        await axios.put(`${API}/tipos-recurso/${req.params.id}`, {
            ativo: req.body.ativo
        }, {
            headers: obterHeadersAutorizacao(req)
        });

        res.redirect('/admin/tiposrecursos?sucesso=estado-atualizado');
    } catch (err) {
        res.status(err.response?.status || 500).render('erro', {
            titulo: 'Erro',
            mensagem: obterMensagemErroAPI(err, 'Nao foi possivel atualizar o estado do tipo de recurso.')
        });
    }
});

router.get('/gestaoaips', async (req, res) => {
    if (!garantirAdmin(req, res)) return;

    try {
        const resposta = await axios.get(`${API}/ingestao/aips`, {
            headers: obterHeadersAutorizacao(req),
            params: req.query
        });

        res.render('recursos/aips', {
            titulo: 'Gestão de AIPs',
            aips: resposta.data.aips || [],
            paginacao: resposta.data.paginacao || {},
            admin: true
        });
    } catch (err) {
        res.status(err.response?.status || 500).render('erro', {
            titulo: 'Erro',
            mensagem: obterMensagemErroAPI(err, 'Nao foi possivel carregar a gestão de AIPs.')
        });
    }
});

router.get('/exportacao', async (req, res) => {
    if (!garantirAdmin(req, res)) return;

    res.render('recursos/exportacao', {
        titulo: 'Exportação de Dados'
    });
});

router.get('/exportacao/utilizadores', async (req, res) => {
    if (!garantirAdmin(req, res)) return;

    try {
        const resposta = await axios.get(`${AUTH}`, {
            headers: obterHeadersAutorizacao(req)
        });

        enviarJSONDownload(res, `utilizadores-${Date.now()}.json`, {
            tipo: 'utilizadores',
            dataExportacao: new Date().toISOString(),
            total: Array.isArray(resposta.data) ? resposta.data.length : 0,
            utilizadores: resposta.data || []
        });
    } catch (err) {
        renderErro(res, err, 'Nao foi possivel exportar os utilizadores.');
    }
});

router.get('/exportacao/recursos', async (req, res) => {
    if (!garantirAdmin(req, res)) return;

    try {
        const recursos = await obterTodosRecursos();

        enviarJSONDownload(res, `recursos-metadados-${Date.now()}.json`, {
            tipo: 'recursos-metadados',
            dataExportacao: new Date().toISOString(),
            total: Array.isArray(recursos) ? recursos.length : 0,
            recursos
        });
    } catch (err) {
        renderErro(res, err, 'Nao foi possivel exportar os metadados dos recursos.');
    }
});

router.get('/exportacao/dips', async (req, res) => {
    if (!garantirAdmin(req, res)) return;

    try {
        const recursos = await obterTodosRecursos();
        const ids = recursos.map(recurso => recurso._id).filter(Boolean);

        if (ids.length === 0) {
            return res.status(404).render('recursos/exportacao', {
                titulo: 'Exportação de Dados',
                erro: 'Não existem recursos para exportar.'
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
            res.setHeader('Content-Disposition', `attachment; filename="dips-recursos-${Date.now()}.zip"`);
        }

        res.send(Buffer.from(resposta.data));
    } catch (err) {
        renderErro(res, err, 'Nao foi possivel exportar os DIPs dos recursos.');
    }
});

router.get('/exportacao/aips', async (req, res) => {
    if (!garantirAdmin(req, res)) return;

    try {
        const resposta = await axios.get(`${API}/ingestao/aips`, {
            headers: obterHeadersAutorizacao(req),
            params: { limit: 10000 }
        });

        const aips = resposta.data && resposta.data.aips ? resposta.data.aips : [];

        enviarJSONDownload(res, `aips-${Date.now()}.json`, {
            tipo: 'aips',
            dataExportacao: new Date().toISOString(),
            total: aips.length,
            aips
        });
    } catch (err) {
        renderErro(res, err, 'Nao foi possivel exportar os AIPs.');
    }
});

router.get('/exportacao/noticias', async (req, res) => {
    if (!garantirAdmin(req, res)) return;

    try {
        const resposta = await axios.get(`${API}/noticias`);
        const noticias = resposta.data || [];

        enviarJSONDownload(res, `noticias-${Date.now()}.json`, {
            tipo: 'noticias',
            dataExportacao: new Date().toISOString(),
            total: Array.isArray(noticias) ? noticias.length : 0,
            noticias
        });
    } catch (err) {
        renderErro(res, err, 'Nao foi possivel exportar as notícias.');
    }
});

router.get('/exportacao/historicos', async (req, res) => {
    if (!garantirAdmin(req, res)) return;

    try {
        const recursos = await obterTodosRecursos();
        const historicoAIPs = [];
        const historicoExportacoes = [];

        for (const recurso of recursos) {
            try {
                const resposta = await axios.get(`${API}/ingestao/recursos/${recurso._id}/historico-aip`, {
                    headers: obterHeadersAutorizacao(req)
                });
                historicoAIPs.push(resposta.data);
            } catch (err) {
                historicoAIPs.push({
                    recursoId: recurso._id,
                    erro: obterMensagemErroAPI(err, 'Histórico AIP indisponível.')
                });
            }

            try {
                const resposta = await axios.get(`${API}/disseminacao/recursos/${recurso._id}/historico-exportacoes`, {
                    headers: obterHeadersAutorizacao(req),
                    params: { limit: 10000 }
                });
                historicoExportacoes.push(resposta.data);
            } catch (err) {
                historicoExportacoes.push({
                    recursoId: recurso._id,
                    erro: obterMensagemErroAPI(err, 'Histórico de exportações indisponível.')
                });
            }
        }

        const postsRes = await axios.get(`${API}/posts`);
        const posts = postsRes.data || [];

        enviarJSONDownload(res, `historicos-${Date.now()}.json`, {
            tipo: 'historicos',
            dataExportacao: new Date().toISOString(),
            recursos: recursos.map(recurso => ({
                _id: recurso._id,
                titulo: recurso.titulo,
                ratings: recurso.ratings || [],
                mediaEstrelas: recurso.mediaEstrelas || 0
            })),
            historicoAIPs,
            historicoExportacoes,
            posts,
            comentarios: posts.flatMap(post => (post.comentarios || []).map(comentario => ({
                ...comentario,
                post: post._id,
                recurso: post.recurso
            })))
        });
    } catch (err) {
        renderErro(res, err, 'Nao foi possivel exportar os históricos.');
    }
});

module.exports = router;
