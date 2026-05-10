const Noticia = require('../models/noticia');
const Recurso = require('../models/recurso');
const Post = require('../models/post');
const TipoRecurso = require('../models/tipoRecurso');

function formatarData(data) {
    return data instanceof Date ? data : new Date(data);
}

async function gerarNoticiasAutomaticas(limit = 10) {
    const noticias = [];
    const agora = new Date();
    const seteDiasAtras = new Date(agora.getTime() - 7 * 24 * 60 * 60 * 1000);

    const recursosRecentes = await Recurso.find({ dataRegisto: { $gte: seteDiasAtras } })
        .sort({ dataRegisto: -1 })
        .limit(3)
        .select('titulo tipo dataRegisto mediaEstrelas ratings visibilidade');

    for (const recurso of recursosRecentes) {
        noticias.push({
            titulo: 'Novo recurso adicionado',
            conteudo: `Foi adicionado "${recurso.titulo}" (${recurso.tipo}).`,
            tipo: 'novo_recurso',
            link: `/recursos/${recurso._id}`,
            dataCriacao: formatarData(recurso.dataRegisto),
            origem: 'sistema'
        });
    }

    const trending = await Recurso.find({ mediaEstrelas: { $gt: 0 } })
        .sort({ mediaEstrelas: -1, dataRegisto: -1 })
        .limit(2)
        .select('titulo mediaEstrelas ratings dataRegisto');

    for (const recurso of trending) {
        noticias.push({
            titulo: 'Trending agora',
            conteudo: `"${recurso.titulo}" está com ${Number(recurso.mediaEstrelas || 0).toFixed(1)} estrelas e ${recurso.ratings ? recurso.ratings.length : 0} votos.`,
            tipo: 'trending',
            link: `/recursos/${recurso._id}`,
            dataCriacao: formatarData(recurso.dataRegisto || agora),
            origem: 'sistema'
        });
    }

    const maisComentado = await Post.aggregate([
        { $project: { recurso: 1, numComentarios: { $size: { $ifNull: ['$comentarios', []] } } } },
        { $group: { _id: '$recurso', totalComentarios: { $sum: '$numComentarios' } } },
        { $sort: { totalComentarios: -1 } },
        { $limit: 1 }
    ]);

    if (maisComentado.length > 0 && maisComentado[0]._id) {
        const recurso = await Recurso.findById(maisComentado[0]._id).select('titulo dataRegisto');
        if (recurso) {
            noticias.push({
                titulo: 'Recurso mais comentado',
                conteudo: `"${recurso.titulo}" tem ${maisComentado[0].totalComentarios} comentários.`,
                tipo: 'comentarios',
                link: `/recursos/${recurso._id}`,
                dataCriacao: formatarData(recurso.dataRegisto || agora),
                origem: 'sistema'
            });
        }
    }

    const destaqueTipo = await Recurso.aggregate([
        { $match: { dataRegisto: { $gte: seteDiasAtras } } },
        { $group: { _id: '$tipo', total: { $sum: 1 } } },
        { $sort: { total: -1 } },
        { $limit: 1 }
    ]);

    if (destaqueTipo.length > 0) {
        const tipo = await TipoRecurso.findOne({ slug: destaqueTipo[0]._id }).select('nome slug');
        noticias.push({
            titulo: 'Tipo em destaque',
            conteudo: `${tipo ? tipo.nome : destaqueTipo[0]._id} lidera com ${destaqueTipo[0].total} novos recursos esta semana.`,
            tipo: 'tipo_destaque',
            link: '/recursos',
            dataCriacao: agora,
            origem: 'sistema'
        });
    }

    const totalRecursos = await Recurso.countDocuments();
    const totalTipos = await TipoRecurso.countDocuments({ ativo: true });
    const mediaEstrelas = await Recurso.aggregate([
        { $group: { _id: null, media: { $avg: '$mediaEstrelas' } } }
    ]);

    noticias.push({
        titulo: 'Estatísticas da plataforma',
        conteudo: `${totalRecursos} recursos publicados em ${totalTipos} tipos ativos. Média global de ${Number(mediaEstrelas[0]?.media || 0).toFixed(1)} estrelas.`,
        tipo: 'stats',
        link: '/recursos',
        dataCriacao: agora,
        origem: 'sistema'
    });

    if (totalRecursos > 0 && totalRecursos % 10 === 0) {
        noticias.push({
            titulo: 'Marco da plataforma',
            conteudo: `A plataforma atingiu ${totalRecursos} recursos.`,
            tipo: 'milestone',
            link: '/recursos',
            dataCriacao: agora,
            origem: 'sistema'
        });
    }

    return noticias
        .sort((a, b) => new Date(b.dataCriacao) - new Date(a.dataCriacao))
        .slice(0, limit);
}

const noticiasController = {
    // GET /noticias
    getAllNoticias: async (req, res) => {
        try {
            const limit = parseInt(req.query.limit) || 20;
            const noticias = await gerarNoticiasAutomaticas(limit);
            res.json(noticias);
        } catch (err) {
            res.status(500).json({ erro: err.message });
        }
    },

    // POST /noticias
    createNoticia: async (req, res) => {
        try {
            const { titulo, conteudo, tipo, link, autorNome } = req.body;
            if (!titulo) return res.status(400).json({ erro: 'Titulo obrigatório' });
            const noticia = await Noticia.create({ titulo, conteudo, tipo, link, autorNome });
            res.status(201).json(noticia);
        } catch (err) {
            res.status(500).json({ erro: err.message });
        }
    }
};

module.exports = noticiasController;
