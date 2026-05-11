var path = require('path');
var axios = require('axios');
var FormData = require('form-data');

const COOKIE_NAME = process.env.COOKIE_NAME || 'auth_token_alunos';

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

function obterMensagemErroAPI(err, fallback = 'Ocorreu um erro ao contactar a API.') {
    const data = err.response && err.response.data;

    if (!data) return fallback;

    if (Buffer.isBuffer(data)) {
        try {
            const parsed = JSON.parse(data.toString('utf8'));
            return parsed.mensagem || parsed.erro || parsed.error || fallback;
        } catch (parseErr) {
            return fallback;
        }
    }

    if (typeof data === 'string') return data;

    return data.mensagem || data.erro || data.error || fallback;
}

function enviarJSONDownload(res, nomeArquivo, dados) {
    const buffer = Buffer.from(JSON.stringify(dados, null, 2), 'utf8');
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
    res.setHeader('Content-Length', buffer.length);
    res.send(buffer);
}

function obterContentTypePreview(nome = '', contentTypeOriginal = '') {
    const tipo = String(contentTypeOriginal || '').toLowerCase();
    if (tipo && tipo !== 'application/octet-stream') return contentTypeOriginal;

    const ext = path.extname(nome).toLowerCase();
    const tipos = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml',
        '.pdf': 'application/pdf',
        '.txt': 'text/plain; charset=utf-8',
        '.md': 'text/markdown; charset=utf-8',
        '.csv': 'text/csv; charset=utf-8',
        '.json': 'application/json; charset=utf-8',
        '.xml': 'application/xml; charset=utf-8',
        '.html': 'text/html; charset=utf-8'
    };

    return tipos[ext] || contentTypeOriginal || 'application/octet-stream';
}

function garantirAdmin(req, res) {
    if (utilizadorEhAdmin(req)) return true;
    res.redirect('/recursos');
    return false;
}

async function obterTodosRecursos(apiUrl) {
    const resposta = await axios.get(`${apiUrl}/recursos`, {
        params: { limit: 10000 }
    });

    return resposta.data || [];
}

async function obterTodosTiposAdmin(req, apiUrl) {
    const resposta = await axios.get(`${apiUrl}/tipos-recurso/todos`, {
        headers: obterHeadersAutorizacao(req)
    });
    return resposta.data;
}

function renderErroVista(res, err, fallback, vista = 'erro', extras = {}) {
    res.status(err.response?.status || 500).render(vista, {
        titulo: 'Erro',
        mensagem: obterMensagemErroAPI(err, fallback),
        ...extras
    });
}

async function obterTiposAtivos(apiUrl) {
    const resposta = await axios.get(`${apiUrl}/tipos-recurso`);
    return resposta.data;
}

async function encaminharRecursoSip(req, apiUrl) {
    const form = new FormData();

    // Adicionar arquivo ZIP com o nome 'file' que o backend espera
    if (req.file) {
        form.append('file', req.file.buffer, {
            filename: req.file.originalname || 'recurso.zip',
            contentType: req.file.mimetype || 'application/zip'
        });
    }

    return axios.post(`${apiUrl}/ingestao/sip`, form, {
        headers: {
            ...obterHeadersAutorizacao(req),
            ...form.getHeaders()
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity
    });
}

async function encaminharSipZip(req, apiUrl) {
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

    return axios.post(`${apiUrl}/ingestao/sip`, form, {
        headers: {
            ...obterHeadersAutorizacao(req),
            ...form.getHeaders()
        },
        maxBodyLength: Infinity,
        maxContentLength: Infinity
    });
}

async function submeterRecursoSip(req, res, apiUrl) {
    try {
        const resposta = await encaminharRecursoSip(req, apiUrl);
        const body = resposta.data || {};

        if (body.status === 'ok') {
            return res.redirect(`/recursos?autor=${req.user.sub || ''}`);
        }

        let tiposRecurso = [];
        try {
            tiposRecurso = await obterTiposAtivos(apiUrl);
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
            tiposRecurso = await obterTiposAtivos(apiUrl);
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
}

function obterDestinoRecurso(req) {
    return req.body && req.body.recurso ? `/recursos/${req.body.recurso}` : '/recursos';
}

module.exports = {
    obterToken,
    obterHeadersAutorizacao,
    utilizadorEhAdmin,
    obterMensagemErroAPI,
    enviarJSONDownload,
    obterContentTypePreview,
    garantirAdmin,
    obterTodosRecursos,
    obterTodosTiposAdmin,
    renderErroVista,
    obterTiposAtivos,
    encaminharRecursoSip,
    encaminharSipZip,
    submeterRecursoSip,
    obterDestinoRecurso
};
