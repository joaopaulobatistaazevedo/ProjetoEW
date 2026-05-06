const TipoRecurso = require('../models/tipoRecurso');

const TIPOS_RECURSO_BASE = [
    { slug: 'artigo', nome: 'Artigo', descricao: 'Artigos e textos academicos.', ordem: 10, sistema: true },
    { slug: 'tese', nome: 'Tese', descricao: 'Teses e dissertacoes.', ordem: 20, sistema: true },
    { slug: 'slides', nome: 'Slides', descricao: 'Apresentacoes e diapositivos.', ordem: 30, sistema: true },
    { slug: 'teste', nome: 'Teste', descricao: 'Testes, fichas e avaliacoes.', ordem: 40, sistema: true },
    { slug: 'relatorio', nome: 'Relatorio', descricao: 'Relatorios tecnicos ou cientificos.', ordem: 50, sistema: true },
    { slug: 'aplicacao', nome: 'Aplicacao', descricao: 'Aplicacoes, software ou prototipos.', ordem: 60, sistema: true },
    { slug: 'problema', nome: 'Problema', descricao: 'Problemas, exercicios e desafios.', ordem: 70, sistema: true },
    { slug: 'outro', nome: 'Outro', descricao: 'Outro tipo de recurso.', ordem: 80, sistema: true }
];

function slugifyTipo(valor) {
    return String(valor || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

async function ensureTiposRecursoBase() {
    const operacoes = TIPOS_RECURSO_BASE.map(tipo => ({
        updateOne: {
            filter: { slug: tipo.slug },
            update: { $setOnInsert: tipo },
            upsert: true
        }
    }));

    if (!operacoes.length) return;
    await TipoRecurso.bulkWrite(operacoes, { ordered: false });
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
    TIPOS_RECURSO_BASE,
    slugifyTipo,
    ensureTiposRecursoBase,
    listarTiposAtivos,
    listarTodosTipos,
    obterTipoAtivoPorSlug,
    enriquecerComTipos
};
