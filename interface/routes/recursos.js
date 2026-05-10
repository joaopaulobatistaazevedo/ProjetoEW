var express = require('express');
var router = express.Router();
var axios = require('axios');
var FormData = require('form-data');
var path = require('path');

const API         = process.env.API_URL     || 'http://localhost:3001';
const AUTH        = process.env.AUTH_URL    || 'http://localhost:3002/users';
const COOKIE_NAME = process.env.COOKIE_NAME || 'auth_token_alunos';
const { uploadSipZip } = require('../middleware/uploadZip');

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

async function encaminharRecursoSip(req) {
    const form = new FormData();

    // Adicionar arquivo ZIP com o nome 'file' que o backend espera
    if (req.file) {
        form.append('file', req.file.buffer, {
            filename: req.file.originalname || 'recurso.zip',
            contentType: req.file.mimetype || 'application/zip'
        });
    }

    return axios.post(`${API}/ingestao/sip`, form, {
        headers: {
            ...obterHeadersAutorizacao(req),
            ...form.getHeaders()
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity
    });
}

async function encaminharSipZip(req) {
    const form = new FormData();

    if (req.file) {
        form.append('file', req.file.buffer, {
            filename: req.file.originalname || 'sip.zip',
            contentType: req.file.mimetype || 'application/zip'
        });
    }

    Object.entries(req.body || {}).forEach(([chave, valor]) => {
        if (valor !== undefined && valor !== null) {
            form.append(chave, valor);
        }
    });

    return axios.post(`${API}/ingestao/sip`, form, {
        headers: {
            ...obterHeadersAutorizacao(req),
            ...form.getHeaders()
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity
    });
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

// GET /recursos/ingestao-sip — formulário de ingestão SIP
router.get('/ingestao-sip', async (req, res) => {
    res.render('recursos/ingestao', {
        titulo: 'Submeter SIP',
        sucesso: req.query.sucesso || '',
        erro: req.query.erro || ''
    });
});

// POST /recursos/ingestao-sip — submeter SIP para a API
router.post('/ingestao-sip', uploadSipZip, async (req, res) => {
    try {
        const resposta = await encaminharSipZip(req);
        const body = resposta.data || {};

        if (body.status === 'ok') {
            return res.redirect(`/recursos/aips/${body.aipId || body.sipId || ''}`);
        }

        return res.status(400).render('recursos/ingestao', {
            titulo: 'Submeter SIP',
            erro: body.mensagem || 'SIP rejeitado',
            detalhes: body.relatorio ? JSON.stringify(body.relatorio, null, 2) : ''
        });
    } catch (err) {
        const body = err.response && err.response.data ? err.response.data : {};
        return res.status(err.response?.status || 500).render('recursos/ingestao', {
            titulo: 'Submeter SIP',
            erro: body.mensagem || obterMensagemErroAPI(err, 'Nao foi possivel submeter o SIP.'),
            detalhes: body.relatorio ? JSON.stringify(body.relatorio, null, 2) : (body.erros ? JSON.stringify(body.erros, null, 2) : '')
        });
    }
});

// GET /recursos/novo — formulário de criação (SIP obrigatório)
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

// POST /recursos/novo — submeter recurso com SIP
router.post('/novo', uploadSipZip, async (req, res) => {
    try {
        const resposta = await encaminharRecursoSip(req);
        const body = resposta.data || {};

        if (body.status === 'ok') {
            return res.redirect(`/recursos?autor=${req.user.sub || ''}`);
        }

        let tiposRecurso = [];
        try {
            tiposRecurso = await obterTiposAtivos();
        } catch (tiposErr) {
            tiposRecurso = [];
        }

        // Extrair erros específicos
        let mensagensErro = [];
        if (body.erros && Array.isArray(body.erros)) {
            mensagensErro = body.erros.map(e => `${e.categoria}: ${e.mensagem}`);
        }

        return res.status(400).render('recursos/form', {
            titulo: 'Submeter Recurso',
            recurso: req.body,
            tiposRecurso,
            erro: body.mensagem || 'SIP rejeitado - validação falhou',
            erros: mensagensErro,
            detalhes: body.relatorio ? JSON.stringify(body.relatorio, null, 2) : ''
        });
    } catch (err) {
        let tiposRecurso = [];
        try {
            tiposRecurso = await obterTiposAtivos();
        } catch (tiposErr) {
            tiposRecurso = [];
        }

        const body = err.response && err.response.data ? err.response.data : {};
        return res.status(err.response?.status || 500).render('recursos/form', {
            titulo: 'Submeter Recurso',
            recurso: req.body,
            tiposRecurso,
            erro: body.mensagem || obterMensagemErroAPI(err, 'Erro ao submeter o recurso.'),
            erros: body.erros ? body.erros.map(e => `${e.categoria}: ${e.mensagem}`) : [],
            detalhes: body.relatorio ? JSON.stringify(body.relatorio, null, 2) : (body.erros ? JSON.stringify(body.erros, null, 2) : '')
        });
    }
});

// GET /recursos/tipos — gestao de tipos de recurso (admin)
router.get('/tipos', async (req, res) => {
    if (!utilizadorEhAdmin(req)) {
        return res.redirect('/recursos');
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
        return res.redirect('/recursos');
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
        return res.redirect('/recursos');
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
        return res.redirect('/recursos/aips');
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
        return res.redirect('/recursos');
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

        const recurso = recursoRes.data || {};
        if (recurso.ficheiro) {
            recurso.ficheiroNome = path.basename(recurso.ficheiro);
            recurso.ficheiroExt = path.extname(recurso.ficheiroNome).toLowerCase();
            recurso.ficheiroPreviewUrl = `/recursos/${req.params.id}/ficheiro`;
        }

        res.render('recursos/detalhe', {
            titulo: recurso.titulo,
            recurso,
            posts: postsRes.data
        });
    } catch (err) {
        res.status(404).render('erro', { titulo: 'Erro', mensagem: 'Recurso não encontrado' });
    }
});

// GET /recursos/:id/ficheiro — proxy autenticado para preview do ficheiro associado
router.get('/:id/ficheiro', async (req, res) => {
    try {
        const token = req.cookies[COOKIE_NAME];
        const resposta = await axios.get(`${API}/recursos/${req.params.id}/preview`, {
            headers: { Authorization: `Bearer ${token}` },
            responseType: 'arraybuffer'
        });

        const headersPassThrough = ['content-type', 'content-length', 'content-disposition'];
        headersPassThrough.forEach(nome => {
            if (resposta.headers[nome]) {
                res.setHeader(nome, resposta.headers[nome]);
            }
        });

        res.send(Buffer.from(resposta.data));
    } catch (err) {
        res.status(err.response?.status || 500).render('erro', {
            titulo: 'Erro',
            mensagem: obterMensagemErroAPI(err, 'Nao foi possivel carregar o ficheiro.')
        });
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

// POST /recursos/:id/rate — encaminhar avaliação para a API
router.post('/:id/rate', async (req, res) => {
    try {
        const estrelas = parseInt(req.body.estrelas, 10);
        await axios.patch(`${API}/recursos/${req.params.id}/rate`, { estrelas }, {
            headers: obterHeadersAutorizacao(req)
        });
        res.redirect(`/recursos/${req.params.id}`);
    } catch (err) {
        // Se houver erro, redirecionar para detalhe com mensagem simples via query
        const msg = err.response && err.response.data && err.response.data.erro ? err.response.data.erro : 'Erro ao registar avaliação.';
        res.redirect(`/recursos/${req.params.id}?erro=${encodeURIComponent(msg)}`);
    }
});

module.exports = router;
