var express = require('express');
var router = express.Router();
var axios = require('axios');
var FormData = require('form-data');

const API         = process.env.API_URL     || 'http://localhost:3001';
const AUTH        = process.env.AUTH_URL    || 'http://localhost:3002/users';
const COOKIE_NAME = process.env.COOKIE_NAME || 'auth_token_alunos';
const { uploadRecursoSingle } = require('../middleware/uploadRecurso');

function obterToken(req) {
    return req.cookies[COOKIE_NAME];
}

function obterHeadersAutorizacao(req) {
    const token = obterToken(req);
    return token ? { Authorization: `Bearer ${token}` } : {};
}

function utilizadorEhAdmin(req) {
    return req.user && req.user.role === 'admin';
}

async function obterTiposAtivos() {
    const resposta = await axios.get(`${API}/tipos-recurso`);
    return resposta.data;
}

async function obterTodosTiposAdmin(req) {
    const resposta = await axios.get(`${API}/tipos-recurso/todos`, {
        headers: obterHeadersAutorizacao(req)
    });
    return resposta.data;
}

function obterMensagemErroAPI(err, fallback = 'Ocorreu um erro ao contactar a API.') {
    const data = err.response && err.response.data;

    if (!data) {
        return fallback;
    }

    if (Buffer.isBuffer(data)) {
        try {
            const parsed = JSON.parse(data.toString('utf8'));
            return parsed.mensagem || parsed.erro || parsed.error || fallback;
        } catch (parseErr) {
            return fallback;
        }
    }

    if (typeof data === 'string') {
        return data;
    }

    return data.mensagem || data.erro || data.error || fallback;
}

async function encaminharRecursoMultipart(req, metodo, endpoint) {
    const form = new FormData();

    Object.entries(req.body || {}).forEach(([chave, valor]) => {
        if (valor === undefined || valor === null) {
            return;
        }

        if (Array.isArray(valor)) {
            valor.forEach(item => form.append(chave, item));
            return;
        }

        form.append(chave, valor);
    });

    // Adicionar ficheiro único se existir
    if (req.file) {
        form.append('ficheiro', req.file.buffer, {
            filename: req.file.originalname || req.file.filename || 'ficheiro',
            contentType: req.file.mimetype || 'application/octet-stream'
        });
    }

    const config = {
        headers: {
            ...obterHeadersAutorizacao(req),
            ...form.getHeaders()
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity
    };

    if (metodo === 'put') {
        return axios.put(`${API}${endpoint}`, form, config);
    }

    return axios.post(`${API}${endpoint}`, form, config);
}

// GET /recursos — listagem com filtros
router.get('/', async (req, res) => {
    try {
        const filtros = { ...req.query };
        const autorAtual = req.user && (req.user.sub || req.user.id);

        // A lista geral só mostra recursos públicos.
        // A vista "Meus Recursos" pode incluir privados apenas do próprio autor.
        if (filtros.autor && autorAtual && String(filtros.autor) === String(autorAtual)) {
            delete filtros.visibilidade;
        } else {
            filtros.visibilidade = 'publico';
            if (filtros.autor && autorAtual && String(filtros.autor) !== String(autorAtual)) {
                delete filtros.autor;
            }
        }

        const [recursosRes, tiposRecurso] = await Promise.all([
            axios.get(`${API}/recursos`, { params: filtros }),
            obterTiposAtivos()
        ]);

        res.render('recursos/lista', {
            titulo: 'Recursos',
            recursos: recursosRes.data,
            filtros,
            tiposRecurso
        });
    } catch (err) {
        res.render('recursos/lista', {
            titulo: 'Recursos',
            recursos: [],
            filtros: req.query || {},
            tiposRecurso: [],
            erro: obterMensagemErroAPI(err, 'Nao foi possivel carregar os recursos.')
        });
    }
});

// GET /recursos/novo — formulário de criação
router.get('/novo', async (req, res) => {
    try {
        const tiposRecurso = await obterTiposAtivos();
        res.render('recursos/form', {
            titulo: 'Submeter Recurso',
            recurso: null,
            tiposRecurso
        });
    } catch (err) {
        res.status(500).render('erro', {
            titulo: 'Erro',
            mensagem: obterMensagemErroAPI(err, 'Nao foi possivel carregar os tipos de recurso.')
        });
    }
});

// POST /recursos/novo — submeter recurso com upload
router.post('/novo', uploadRecursoSingle, async (req, res) => {
    try {
        const resposta = await encaminharRecursoMultipart(req, 'post', '/recursos');

        const roleAtual = req.user && req.user.role;
        const ehConsumidor = roleAtual === 'consumidor';

        if (ehConsumidor && req.user && req.user.sub) {
            const token = obterToken(req);
            const promovido = await axios.put(`${AUTH}/${req.user.sub}/promote/produtor`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (promovido.data && promovido.data.token) {
                res.cookie(COOKIE_NAME, promovido.data.token, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    maxAge: 3600000
                });
            }
        }

        res.redirect('/recursos');
    } catch (err) {
        let tiposRecurso = [];

        try {
            tiposRecurso = await obterTiposAtivos();
        } catch (tiposErr) {
            tiposRecurso = [];
        }

        res.status(err.response?.status || 500).render('recursos/form', {
            titulo: 'Submeter Recurso',
            recurso: req.body,
            tiposRecurso,
            erro: obterMensagemErroAPI(err, 'Nao foi possivel submeter o recurso.')
        });
    }
});

// GET /recursos/tipos — gestao de tipos de recurso (admin)
router.get('/tipos', async (req, res) => {
    if (!utilizadorEhAdmin(req)) {
        return res.status(403).render('erro', {
            titulo: 'Sem permissao',
            mensagem: 'Apenas administradores podem gerir tipos de recurso.'
        });
    }

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

// POST /recursos/tipos/novo — criar novo tipo (admin)
router.post('/tipos/novo', async (req, res) => {
    if (!utilizadorEhAdmin(req)) {
        return res.status(403).render('erro', {
            titulo: 'Sem permissao',
            mensagem: 'Apenas administradores podem gerir tipos de recurso.'
        });
    }

    try {
        await axios.post(`${API}/tipos-recurso`, req.body, {
            headers: obterHeadersAutorizacao(req)
        });

        res.redirect('/recursos/tipos?sucesso=tipo-criado');
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

// POST /recursos/tipos/:id/estado — ativar/desativar tipo (admin)
router.post('/tipos/:id/estado', async (req, res) => {
    if (!utilizadorEhAdmin(req)) {
        return res.status(403).render('erro', {
            titulo: 'Sem permissao',
            mensagem: 'Apenas administradores podem gerir tipos de recurso.'
        });
    }

    try {
        await axios.put(`${API}/tipos-recurso/${req.params.id}`, {
            ativo: req.body.ativo
        }, {
            headers: obterHeadersAutorizacao(req)
        });

        res.redirect('/recursos/tipos?sucesso=estado-atualizado');
    } catch (err) {
        res.status(err.response?.status || 500).render('erro', {
            titulo: 'Erro',
            mensagem: obterMensagemErroAPI(err, 'Nao foi possivel atualizar o estado do tipo de recurso.')
        });
    }
});

// GET /recursos/aips — listar AIPs do utilizador
router.get('/aips', async (req, res) => {
    try {
        const resposta = await axios.get(`${API}/ingestao/aips`, {
            headers: obterHeadersAutorizacao(req),
            params: req.query
        });

        res.render('recursos/aips', {
            titulo: 'AIPs',
            aips: resposta.data.aips || [],
            paginacao: resposta.data.paginacao || {}
        });
    } catch (err) {
        res.render('recursos/aips', {
            titulo: 'AIPs',
            aips: [],
            erro: obterMensagemErroAPI(err, 'Nao foi possivel carregar os AIPs.')
        });
    }
});

// GET /recursos/aips/:sipId — detalhe de um AIP
router.get('/aips/:sipId', async (req, res) => {
    try {
        const resposta = await axios.get(`${API}/ingestao/aips/${req.params.sipId}`, {
            headers: obterHeadersAutorizacao(req)
        });

        res.render('recursos/aip_detalhe', {
            titulo: `AIP ${req.params.sipId}`,
            aip: resposta.data.aip
        });
    } catch (err) {
        res.status(err.response?.status || 500).render('erro', {
            titulo: 'Erro',
            mensagem: obterMensagemErroAPI(err, 'Nao foi possivel obter o detalhe do AIP.')
        });
    }
});

// GET /recursos/ingestao — vista administrativa para Ingestões (AIPs)
router.get('/ingestao', async (req, res) => {
    if (!utilizadorEhAdmin(req)) {
        return res.status(403).render('erro', {
            titulo: 'Sem permissao',
            mensagem: 'Apenas administradores podem aceder a esta página.'
        });
    }

    try {
        const resposta = await axios.get(`${API}/ingestao/aips`, {
            headers: obterHeadersAutorizacao(req),
            params: req.query
        });

        res.render('recursos/aips', {
            titulo: 'Ingestões (AIPs)',
            aips: resposta.data.aips || [],
            paginacao: resposta.data.paginacao || {},
            admin: true
        });
    } catch (err) {
        res.status(err.response?.status || 500).render('erro', {
            titulo: 'Erro',
            mensagem: obterMensagemErroAPI(err, 'Nao foi possivel carregar as ingestões.')
        });
    }
});

// GET /recursos/admin — hub de administração
router.get('/admin', async (req, res) => {
    if (!utilizadorEhAdmin(req)) {
        return res.status(403).render('erro', {
            titulo: 'Sem permissao',
            mensagem: 'Apenas administradores podem aceder a esta página.'
        });
    }

    res.render('recursos/admin', {
        titulo: 'Administração'
    });
});

// GET /recursos/:id — detalhe + posts
router.get('/:id', async (req, res) => {
    try {
        const [recursoRes, postsRes] = await Promise.all([
            axios.get(`${API}/recursos/${req.params.id}`),
            axios.get(`${API}/posts?recurso=${req.params.id}`)
        ]);

        res.render('recursos/detalhe', {
            titulo: recursoRes.data.titulo,
            recurso: recursoRes.data,
            posts: postsRes.data
        });
    } catch (err) {
        res.status(404).render('erro', { titulo: 'Erro', mensagem: 'Recurso não encontrado' });
    }
});

// GET /recursos/:id/exportar-dip — proxy autenticado para download DIP
router.get('/:id/exportar-dip', async (req, res) => {
    try {
        const token = req.cookies[COOKIE_NAME];
        const resposta = await axios.get(
            `${API}/disseminacao/recursos/${req.params.id}/exportar`,
            {
                params: req.query,
                headers: { Authorization: `Bearer ${token}` },
                responseType: 'arraybuffer'
            }
        );

        const headersPassThrough = [
            'content-type',
            'content-disposition',
            'content-length',
            'x-dip-checksum',
            'x-dip-size'
        ];

        headersPassThrough.forEach(nome => {
            if (resposta.headers[nome]) {
                res.setHeader(nome, resposta.headers[nome]);
            }
        });

        res.send(Buffer.from(resposta.data));
    } catch (err) {
        res.status(err.response?.status || 500).render('erro', {
            titulo: 'Erro',
            mensagem: obterMensagemErroAPI(err, 'Nao foi possivel exportar o DIP solicitado.')
        });
    }
});

// GET /recursos/:id/editar
router.get('/:id/editar', async (req, res) => {
    try {
        const [recursoRes, tiposRecurso] = await Promise.all([
            axios.get(`${API}/recursos/${req.params.id}`),
            obterTiposAtivos()
        ]);

        const recurso = recursoRes.data;
        const ehAdmin = utilizadorEhAdmin(req);
        const ehDono = recurso.autor && req.user && req.user.sub === recurso.autor._id;

        if (!ehAdmin && !ehDono) {
            return res.status(403).render('erro', {
                titulo: 'Sem permissao',
                mensagem: 'Nao tem permissao para editar este recurso.'
            });
        }

        res.render('recursos/form', {
            titulo: 'Editar Recurso',
            recurso,
            tiposRecurso
        });
    } catch (err) {
        res.redirect('/recursos');
    }
});

// POST /recursos/:id/editar — atualizar com upload
router.post('/:id/editar', uploadRecursoSingle, async (req, res) => {
    try {
        await encaminharRecursoMultipart(req, 'put', `/recursos/${req.params.id}`);
        res.redirect(`/recursos/${req.params.id}`);
    } catch (err) {
        try {
            const [recursoRes, tiposRecurso] = await Promise.all([
                axios.get(`${API}/recursos/${req.params.id}`),
                obterTiposAtivos()
            ]);

            const recurso = {
                ...recursoRes.data,
                ...req.body,
                _id: req.params.id
            };

            res.status(err.response?.status || 500).render('recursos/form', {
                titulo: 'Editar Recurso',
                recurso,
                tiposRecurso,
                erro: obterMensagemErroAPI(err, 'Nao foi possivel atualizar o recurso.')
            });
        } catch (reloadErr) {
            res.redirect('/recursos');
        }
    }
});

// POST /recursos/:id/apagar — remover
router.post('/:id/apagar', async (req, res) => {
    try {
        await axios.delete(`${API}/recursos/${req.params.id}`, {
            headers: obterHeadersAutorizacao(req)
        });
        res.redirect('/recursos');
    } catch (err) {
        res.redirect('/recursos');
    }
});

module.exports = router;
