var path = require('path');

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

module.exports = {
    obterToken,
    obterHeadersAutorizacao,
    utilizadorEhAdmin,
    obterMensagemErroAPI,
    enviarJSONDownload,
    obterContentTypePreview
};
