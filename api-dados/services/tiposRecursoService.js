const TipoRecurso = require('../models/tipoRecurso');

function slugifyTipo(valor) {
    return String(valor || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

async function listarTiposAtivos() {
    return TipoRecurso.find({ ativo: true }).sort({ ordem: 1, nome: 1 }).lean();
}

async function listarTodosTipos() {
    return TipoRecurso.find({}).sort({ ordem: 1, nome: 1 }).lean();
}

async function obterTipoAtivoPorSlug(slug) {
    return TipoRecurso.findOne({ slug, ativo: true });
}

async function obterMapaTipos() {
    const tipos = await listarTodosTipos();
    return new Map(tipos.map(tipo => [tipo.slug, tipo]));
}

function anexarTipoAoObjeto(objeto, mapaTipos) {
    if (!objeto) return objeto;

    const base = typeof objeto.toObject === 'function' ? objeto.toObject() : { ...objeto };
    const tipoInfo = mapaTipos.get(base.tipo);

    return {
        ...base,
        tipoNome: tipoInfo ? tipoInfo.nome : base.tipo,
        tipoInfo: tipoInfo ? {
            slug: tipoInfo.slug,
            nome: tipoInfo.nome,
            descricao: tipoInfo.descricao,
            ativo: tipoInfo.ativo,
            ordem: tipoInfo.ordem
        } : null
    };
}

async function enriquecerComTipos(recursos) {
    const mapaTipos = await obterMapaTipos();

    if (Array.isArray(recursos)) {
        return recursos.map(recurso => anexarTipoAoObjeto(recurso, mapaTipos));
    }

    return anexarTipoAoObjeto(recursos, mapaTipos);
}

module.exports = {
    slugifyTipo,
    listarTiposAtivos,
    listarTodosTipos,
    obterTipoAtivoPorSlug,
    enriquecerComTipos
};
