const crypto = require('crypto');

// ============================================
// NORMALIZAÇÃO DE DADOS
// ============================================

/**
 * Normalizar hashtags para array
 * @param {String|Array} valor - Hashtags (string separada por vírgula ou array)
 * @returns {Array} Array de hashtags limpas
 */
function normalizarHashtags(valor) {
    if (!valor) return [];
    if (Array.isArray(valor)) return valor.map(tag => String(tag).trim()).filter(Boolean);

    if (typeof valor === 'string') {
        try {
            const parsed = JSON.parse(valor);
            if (Array.isArray(parsed)) {
                return parsed.map(tag => String(tag).trim()).filter(Boolean);
            }
        } catch (err) {
            return valor.split(',').map(tag => tag.trim()).filter(Boolean);
        }
    }

    return [];
}

/**
 * Normalizar valor para array
 * @param {Any} valor - Valor a normalizar
 * @returns {Array}
 */
function normalizarLista(valor) {
    if (!valor) return [];
    return Array.isArray(valor) ? valor.filter(Boolean) : [valor].filter(Boolean);
}

/**
 * Normalizar e validar payload
 * @param {Object} body - Request body
 * @param {Object} schema - Schema de normalização { campo: tipo_ou_normalizador }
 * @returns {Object} Payload normalizado
 */
function normalizarPayload(body = {}, schema = {}) {
    const resultado = {};

    Object.entries(schema).forEach(([campo, tipo]) => {
        let valor = body[campo];

        if (valor === undefined || valor === null) return;

        if (typeof tipo === 'function') {
            // Custom normalizador
            resultado[campo] = tipo(valor);
        } else if (tipo === 'string') {
            resultado[campo] = String(valor).trim();
        } else if (tipo === 'number') {
            resultado[campo] = Number(valor);
        } else if (tipo === 'boolean') {
            resultado[campo] = valor === true || valor === 'true' || valor === 'on' || valor === 1;
        } else if (tipo === 'int') {
            resultado[campo] = Number.isFinite(Number(valor)) ? Number(valor) : undefined;
        } else if (tipo === 'date') {
            resultado[campo] = new Date(valor);
        } else if (tipo === 'array') {
            resultado[campo] = normalizarLista(valor);
        }
    });

    return resultado;
}

/**
 * Parse inteiro positivo
 * @param {Any} value - Valor a parsear
 * @returns {Number|null}
 */
function parsePositiveInt(value) {
    const parsed = parseInt(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/**
 * Sanitizar segmento de caminho (remover traversal)
 * @param {String} nome - Nome do ficheiro/path
 * @returns {String} Path sanitizado
 */
function sanitizarSegmentoCaminho(nome = 'ficheiro') {
    return String(nome)
        .replace(/\\/g, '/')
        .split('/')
        .filter(Boolean)
        .join('/');
}

/**
 * Sanitizar nome de ficheiro
 * @param {String} nome - Nome original
 * @returns {String} Nome seguro
 */
function sanitizarNomeFicheiro(nome = 'ficheiro') {
    return String(nome)
        .replace(/[<>:"|?*]/g, '')
        .replace(/\.\./g, '')
        .substring(0, 255)
        .trim();
}

async function obterSipIdBase(aip, findAipById) {
    let atual = aip;

    while (atual && atual.aipAnterior) {
        const anterior = await findAipById(atual.aipAnterior);
        if (!anterior) break;
        atual = anterior;
    }

    return String((atual && atual.sipId) || (aip && aip.sipId) || 'sip')
        .replace(/-v\d+$/i, '');
}

async function gerarSipIdVersao(aipAnterior, novaVersao, findAipById) {
    const base = await obterSipIdBase(aipAnterior, findAipById);
    return `${base}-v${novaVersao}`;
}

// ============================================
// DATA/HORA
// ============================================

/**
 * Obter início do dia
 * @param {Date} data - Data (padrão: agora)
 * @returns {Date}
 */
function inicioDoDia(data = new Date()) {
    const d = new Date(data);
    d.setHours(0, 0, 0, 0);
    return d;
}

/**
 * Obter fim do dia
 * @param {Date} data - Data (padrão: agora)
 * @returns {Date}
 */
function fimDoDia(data = new Date()) {
    const d = new Date(data);
    d.setHours(23, 59, 59, 999);
    return d;
}

/**
 * Próximo dia
 * @param {Date} data - Data
 * @param {Number} dias - Número de dias a adicionar
 * @returns {Date}
 */
function proximoDia(data = new Date(), dias = 1) {
    const d = new Date(data);
    d.setDate(d.getDate() + dias);
    return d;
}

// ============================================
// SEGURANÇA & AUTORIZAÇÃO
// ============================================

/**
 * Verificar se é admin
 * @param {Object} user - User object
 * @returns {Boolean}
 */
function eAdmin(user) {
    return user && user.role === 'admin';
}

/**
 * Verificar se é proprietário
 * @param {Object} user - User object
 * @param {String|ObjectId} recursoAutorId - ID do autor do recurso
 * @returns {Boolean}
 */
function eProprietario(user, recursoAutorId) {
    return user && (
        eAdmin(user) || 
        String(user.id) === String(recursoAutorId)
    );
}

/**
 * Verificar permissão para recurso privado
 * @param {Object} user - User object
 * @param {String|ObjectId} autorId - ID do autor
 * @param {String} visibilidade - 'publico' ou 'privado'
 * @returns {Boolean}
 */
function temPermissaoRecurso(user, autorId, visibilidade) {
    if (visibilidade === 'publico') return true;
    if (!user) return false;
    return eProprietario(user, autorId);
}

/**
 * Verificar permissão para operar sobre recurso (editar/deletar)
 * @param {Object} user - User object
 * @param {String|ObjectId} autorId - ID do autor
 * @returns {Boolean}
 */
function temPermissaoOperacao(user, autorId) {
    return eProprietario(user, autorId);
}

// ============================================
// FICHEIROS
// ============================================

/**
 * Calcular SHA256 de buffer
 * @param {Buffer} buffer - Buffer do ficheiro
 * @returns {String} Hash SHA256
 */
function calcularChecksumBuffer(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Validar se ficheiros foram enviados
 * @param {Object} req - Request object
 * @returns {Array} Array de ficheiros ou []
 */
function ficheirosRecebidos(req) {
    if (req.files && Array.isArray(req.files.ficheirosNovos)) {
        return req.files.ficheirosNovos;
    }

    if (req.file) return [req.file];
    if (req.files && Array.isArray(req.files)) return req.files;
    if (req.files && Array.isArray(req.files.ficheiro)) return req.files.ficheiro;

    return [];
}

const obterFicheirosRecebidos = ficheirosRecebidos;

// ============================================
// PAGINAÇÃO
// ============================================

/**
 * Calcular skip e limit para paginação
 * @param {Number} page - Página (começa em 1)
 * @param {Number} limit - Items por página (padrão: 20)
 * @returns {Object} { skip, limit, page }
 */
function calcularPaginacao(page, limit = 20) {
    const pg = parsePositiveInt(page) || 1;
    const lim = parsePositiveInt(limit) || 20;
    const skip = (pg - 1) * lim;

    return { skip, limit: lim, page: pg };
}

/**
 * Criar resposta com paginação
 * @param {Number} page - Página atual
 * @param {Number} limit - Items por página
 * @param {Number} total - Total de items
 * @returns {Object} Objeto paginação { pagina, limite, total, paginas }
 */
function criarPaginacao(page, limit, total) {
    const pg = parsePositiveInt(page) || 1;
    const lim = parsePositiveInt(limit) || 20;

    return {
        pagina: pg,
        limite: lim,
        total: total,
        paginas: Math.ceil(total / lim)
    };
}

module.exports = {
    // Normalização
    normalizarHashtags,
    normalizarLista,
    normalizarPayload,
    parsePositiveInt,
    sanitizarSegmentoCaminho,
    sanitizarNomeFicheiro,
    obterSipIdBase,
    gerarSipIdVersao,

    // Data/Hora
    inicioDoDia,
    fimDoDia,
    proximoDia,

    // Segurança
    eAdmin,
    eProprietario,
    temPermissaoRecurso,
    temPermissaoOperacao,

    // Ficheiros
    calcularChecksumBuffer,
    ficheirosRecebidos,
    obterFicheirosRecebidos,

    // Paginação
    calcularPaginacao,
    criarPaginacao,

};
