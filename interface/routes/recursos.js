var express = require('express');
var router = express.Router();
var axios = require('axios');
var FormData = require('form-data');
var path = require('path');

const API         = process.env.API_URL     || 'http://localhost:3001';
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
        if (!filtros.autor || !autorAtual || String(filtros.autor) !== String(autorAtual)) {
            filtros.visibilidade = 'publico';
            if (filtros.autor && autorAtual && String(filtros.autor) !== String(autorAtual)) {
                delete filtros.autor;
            }
        }

        const recursosRes = await axios.get(`${API}/recursos`, { params: filtros });
        const tiposRecurso = await obterTiposAtivos();

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

// GET /recursos/novo — escolha do modo de submissão
router.get('/novo', async (req, res) => {
    res.render('recursos/ingestao', {
        titulo: 'Submeter Recurso',
        sucesso: req.query.sucesso || '',
        erro: req.query.erro || ''
    });
});

// GET /recursos/form — submissão de SIP ZIP
router.get('/form', async (req, res) => {
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

async function submeterRecursoSip(req, res) {
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
}

// POST /recursos/form — submeter recurso com SIP
router.post('/form', uploadSipZip, submeterRecursoSip);

// Compatibilidade com formulários antigos que ainda submetam para /recursos/novo
router.post('/novo', uploadSipZip, submeterRecursoSip);

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

// GET /recursos/ingestao-form — formulário assistido de ingestão
router.get('/ingestao-form', async (req, res) => {
    if (!req.user) {
        return res.redirect('/auth/login');
    }

    try {
        const tiposRecurso = await obterTiposAtivos();
        res.render('recursos/ingestao-form', {
            titulo: 'Submeter Recurso — Formulário Assistido',
            formData: {},
            tiposRecurso
        });
    } catch (err) {
        res.status(err.response?.status || 500).render('erro', {
            titulo: 'Erro',
            mensagem: obterMensagemErroAPI(err, 'Nao foi possivel carregar os tipos de recurso.')
        });
    }
});

// POST /recursos/ingestao-form — submeter formulário + ficheiros para gerar SIP
const { uploadMultipleFiles } = require('../middleware/uploadZip');
router.post('/ingestao-form', uploadMultipleFiles.array('ficheiros', 20), async (req, res) => {
    if (!req.user) {
        return res.status(401).json({
            status: 'erro',
            mensagem: 'Não autenticado'
        });
    }

    try {
        // Preparar payload para API
        const formData = new FormData();
        
        // Adicionar metadados
        formData.append('titulo', req.body.titulo);
        formData.append('subtitulo', req.body.subtitulo || '');
        formData.append('descricao', req.body.descricao);
        formData.append('tipo', req.body.tipo);
        formData.append('dataCriacao', req.body.dataCriacao);
        formData.append('visibilidade', req.body.visibilidade || 'publico');
        formData.append('hashtags', req.body.hashtags || '');

        // Adicionar ficheiros
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                formData.append('ficheiros', file.buffer, {
                    filename: file.originalname,
                    contentType: file.mimetype
                });
            }
        }

        // Chamar API
        const resposta = await axios.post(`${API}/ingestao/form`, formData, {
            headers: {
                ...formData.getHeaders(),
                ...obterHeadersAutorizacao(req)
            },
            maxBodyLength: Infinity,
            maxContentLength: Infinity
        });

        // Redirecionar para detalhe do recurso criado
        res.redirect(`/recursos/${resposta.data.recursoId}`);
    } catch (err) {
        console.error('Erro ao submeter formulário:', err.message);
        let tiposRecurso = [];
        try {
            tiposRecurso = await obterTiposAtivos();
        } catch (tiposErr) {
            tiposRecurso = [];
        }

        const body = err.response && err.response.data ? err.response.data : {};
        res.status(err.response?.status || 500).render('recursos/ingestao-form', {
            titulo: 'Submeter Recurso — Formulário Assistido',
            formData: req.body,
            tiposRecurso,
            erro: body.mensagem || obterMensagemErroAPI(err, 'Erro ao processar formulário de ingestão.'),
            erros: body.erros ? body.erros.map(e => `${e.categoria}: ${e.mensagem}`) : [],
            detalhes: body.relatorio ? JSON.stringify(body.relatorio, null, 2) : ''
        });
    }
});

// GET /recursos/:id/editar — formulario de edicao de metadados
router.get('/:id/editar', async (req, res) => {
    try {
        const recursoRes = await axios.get(`${API}/recursos/${req.params.id}`);
        const tiposRecurso = await obterTiposAtivos();

        const recurso = recursoRes.data || {};
        const autorId = recurso.autor && (recurso.autor._id || recurso.autor);
        const podeEditar = req.user && (
            req.user.role === 'admin' ||
            (req.user.role === 'produtor' && String(req.user.sub || req.user.id) === String(autorId))
        );

        if (!podeEditar) {
            return res.status(403).render('erro', {
                titulo: 'Sem permissão',
                mensagem: 'Não tem permissão para editar este recurso.',
                linkVoltar: `/recursos/${req.params.id}`,
                botaoVolta: 'Voltar ao Recurso'
            });
        }

        res.render('recursos/editar', {
            titulo: 'Editar Recurso',
            recurso,
            tiposRecurso
        });
    } catch (err) {
        res.status(err.response?.status || 500).render('erro', {
            titulo: 'Erro',
            mensagem: obterMensagemErroAPI(err, 'Nao foi possivel carregar o recurso para edicao.'),
            linkVoltar: '/recursos',
            botaoVolta: 'Voltar a Recursos'
        });
    }
});

// POST /recursos/:id/editar — atualizar metadados e ficheiros
router.post('/:id/editar', uploadMultipleFiles.array('ficheirosNovos', 20), async (req, res) => {
    const formData = new FormData();

    const payload = {
        titulo: req.body.titulo,
        subtitulo: req.body.subtitulo || '',
        descricao: req.body.descricao || '',
        tipo: req.body.tipo,
        visibilidade: req.body.visibilidade || 'publico',
        hashtags: req.body.hashtags || ''
    };

    if (req.body.dataCriacao) {
        payload.dataCriacao = req.body.dataCriacao;
    }

    Object.entries(payload).forEach(([chave, valor]) => {
        formData.append(chave, valor);
    });

    const ficheirosRemover = Array.isArray(req.body.ficheirosRemover)
        ? req.body.ficheirosRemover
        : req.body.ficheirosRemover
            ? [req.body.ficheirosRemover]
            : [];

    ficheirosRemover.forEach(id => formData.append('ficheirosRemover', id));

    if (req.files && req.files.length > 0) {
        for (const file of req.files) {
            formData.append('ficheirosNovos', file.buffer, {
                filename: file.originalname,
                contentType: file.mimetype || 'application/octet-stream'
            });
        }
    }

    try {
        await axios.put(`${API}/recursos/${req.params.id}`, formData, {
            headers: {
                ...obterHeadersAutorizacao(req),
                ...formData.getHeaders()
            },
            maxBodyLength: Infinity,
            maxContentLength: Infinity
        });

        res.redirect(`/recursos/${req.params.id}`);
    } catch (err) {
        let tiposRecurso = [];
        try {
            tiposRecurso = await obterTiposAtivos();
        } catch (tiposErr) {
            tiposRecurso = [];
        }

        res.status(err.response?.status || 500).render('recursos/editar', {
            titulo: 'Editar Recurso',
            recurso: { ...req.body, _id: req.params.id },
            tiposRecurso,
            erro: obterMensagemErroAPI(err, 'Nao foi possivel atualizar o recurso.')
        });
    }
});

// GET /recursos/:id — detalhe + posts
router.get('/:id', async (req, res) => {
    try {
        const recursoRes = await axios.get(`${API}/recursos/${req.params.id}`);
        const postsRes = await axios.get(`${API}/posts?recurso=${req.params.id}`);

        const recurso = recursoRes.data || {};
        
        // Mostrar todos os ficheiros
        if (recurso.ficheiros && recurso.ficheiros.length > 0) {
            recurso.ficheirosList = recurso.ficheiros.map((f, idx) => ({
                ...f,
                downloadUrl: `/recursos/${req.params.id}/ficheiros/${idx}/download`,
                previewUrl: `/recursos/${req.params.id}/preview`      // JSON com metadados
            }));
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

// GET /recursos/:id/ficheiro/:indice — preview inline de um ficheiro individual
router.get('/:id/ficheiro/:indice', async (req, res) => {
    try {
        const indice = Number(req.params.indice);

        if (!Number.isInteger(indice) || indice < 0) {
            return res.status(404).send('Ficheiro não encontrado');
        }

        const recursoRes = await axios.get(`${API}/recursos/${req.params.id}`);
        const recurso = recursoRes.data || {};
        const ficheiro = recurso.ficheiros && recurso.ficheiros[indice];

        if (!ficheiro) {
            return res.status(404).send('Ficheiro não encontrado');
        }

        const resposta = await axios.get(
            `${API}/disseminacao/recursos/${req.params.id}/ficheiros/${indice}/exportar`,
            {
                headers: obterHeadersAutorizacao(req),
                responseType: 'arraybuffer'
            }
        );

        const buffer = Buffer.from(resposta.data);
        res.setHeader('Content-Type', obterContentTypePreview(ficheiro.nome, resposta.headers['content-type']));
        res.setHeader('Content-Disposition', `inline; filename="${String(ficheiro.nome || `ficheiro-${indice}`).replace(/"/g, '')}"`);
        res.setHeader('Content-Length', buffer.length);
        res.send(buffer);
    } catch (err) {
        res.status(err.response?.status || 500).send(obterMensagemErroAPI(err, 'Nao foi possivel pré-visualizar o ficheiro.'));
    }
});

// GET /recursos/:id/ficheiros/:indice/download — download de um ficheiro individual do DIP
router.get('/:id/ficheiros/:indice/download', async (req, res) => {
    try {
        const indice = Number(req.params.indice);

        if (!Number.isInteger(indice) || indice < 0) {
            return res.status(404).render('erro', {
                titulo: 'Ficheiro não encontrado',
                mensagem: 'O ficheiro pedido não existe neste recurso.',
                linkVoltar: `/recursos/${req.params.id}`,
                botaoVolta: 'Voltar ao Recurso'
            });
        }

        const resposta = await axios.get(
            `${API}/disseminacao/recursos/${req.params.id}/ficheiros/${indice}/exportar`,
            {
                headers: obterHeadersAutorizacao(req),
                responseType: 'arraybuffer'
            }
        );

        ['content-type', 'content-disposition', 'content-length', 'x-dip-checksum', 'x-dip-size'].forEach(nome => {
            if (resposta.headers[nome]) {
                res.setHeader(nome, resposta.headers[nome]);
            }
        });

        res.send(Buffer.from(resposta.data));
    } catch (err) {
        res.status(err.response?.status || 500).render('erro', {
            titulo: 'Erro ao descarregar ficheiro',
            mensagem: obterMensagemErroAPI(err, 'Nao foi possivel descarregar o ficheiro solicitado.'),
            linkVoltar: `/recursos/${req.params.id}`,
            botaoVolta: 'Voltar ao Recurso'
        });
    }
});

// GET /recursos/:id/download — proxy para ZIP com todos os ficheiros preservados
router.get('/:id/download', async (req, res) => {
    try {
        const resposta = await axios.get(
            `${API}/disseminacao/recursos/${req.params.id}/exportar`,
            {
                headers: obterHeadersAutorizacao(req),
                responseType: 'arraybuffer'
            }
        );

        ['content-type', 'content-disposition', 'content-length'].forEach(nome => {
            if (resposta.headers[nome]) {
                res.setHeader(nome, resposta.headers[nome]);
            }
        });

        res.send(Buffer.from(resposta.data));
    } catch (err) {
        res.status(err.response?.status || 500).render('erro', {
            titulo: 'Erro ao descarregar recurso',
            mensagem: obterMensagemErroAPI(err, 'Nao foi possivel descarregar os ficheiros do recurso.'),
            linkVoltar: `/recursos/${req.params.id}`,
            botaoVolta: 'Voltar ao Recurso'
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
        const statusCode = err.response?.status || 500;
        let mensagem = obterMensagemErroAPI(err, 'Nao foi possivel exportar o DIP solicitado.');
        
        if (statusCode === 404) {
            mensagem = 'Este recurso não possui AIP (Archival Information Package). Isto significa que foi criado diretamente sem ingestão de SIP. Para exportar o recurso como DIP, primeiro deve reingerir como SIP através do formulário de submissão.';
        }
        
        res.status(statusCode).render('erro', {
            titulo: 'Erro ao exportar DIP',
            mensagem: mensagem,
            linkVoltar: `/recursos/${req.params.id}`,
            botaoVolta: 'Voltar ao Recurso'
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
