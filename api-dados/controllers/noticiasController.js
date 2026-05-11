const Noticia = require('../models/noticia');
const Recurso = require('../models/recurso');
const Post = require('../models/post');
const TipoRecurso = require('../models/tipoRecurso');

const TIPOS_NOTICIA = [
    'sistema',
    'admin',
    'novo_recurso',
    'trending',
    'comentarios',
    'tipo_destaque',
    'stats',
    'milestone'
];

function parsePositiveInt(value) {
    const parsed = parseInt(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function inicioDoDia(data) {
    const inicio = new Date(data);
    inicio.setHours(0, 0, 0, 0);
    return inicio;
}

async function criarNoticiaSeNaoExistir(noticia, filtro = null) {
    const existe = await Noticia.exists(filtro || {
        titulo: noticia.titulo,
        tipo: noticia.tipo,
        link: noticia.link
    });

    if (existe) return null;
    return Noticia.create(noticia);
}

async function atualizarNoticiaAutomatica(filtro, noticia) {
    return Noticia.findOneAndUpdate(
        filtro,
        {
            $set: {
                ...noticia,
                dataCriacao: new Date()
            }
        },
        {
            upsert: true,
            new: true,
            setDefaultsOnInsert: true
        }
    );
}

async function gerarNoticiasAutomaticas(diasAnalise = null) {
    const agora = new Date();
    const desde = diasAnalise ? new Date(agora.getTime() - diasAnalise * 24 * 60 * 60 * 1000) : null;
    const hoje = inicioDoDia(agora);

    const trending = await Recurso.find({ mediaEstrelas: { $gt: 0 }, visibilidade: 'publico' })
        .sort({ mediaEstrelas: -1, dataRegisto: -1 })
        .select('titulo mediaEstrelas ratings dataRegisto');

    for (const recurso of trending) {
        await criarNoticiaSeNaoExistir({
            titulo: 'Trending agora',
            conteudo: `"${recurso.titulo}" está com ${Number(recurso.mediaEstrelas || 0).toFixed(1)} estrelas e ${recurso.ratings ? recurso.ratings.length : 0} votos.`,
            tipo: 'trending',
            link: `/recursos/${recurso._id}`,
            dataCriacao: agora,
            autorNome: 'Sistema'
        }, {
            titulo: 'Trending agora',
            tipo: 'trending',
            link: `/recursos/${recurso._id}`,
            dataCriacao: { $gte: hoje }
        });
    }

    const maisComentado = await Post.aggregate([
        { $project: { recurso: 1, numComentarios: { $size: { $ifNull: ['$comentarios', []] } } } },
        { $match: { numComentarios: { $gt: 0 } } },
        { $group: { _id: '$recurso', totalComentarios: { $sum: '$numComentarios' } } },
        { $sort: { totalComentarios: -1 } },
        { $limit: 1 }
    ]);

    if (maisComentado.length > 0 && maisComentado[0]._id) {
        const recurso = await Recurso.findById(maisComentado[0]._id).select('titulo');
        if (recurso) {
            await criarNoticiaSeNaoExistir({
                titulo: 'Recurso mais comentado',
                conteudo: `"${recurso.titulo}" tem ${maisComentado[0].totalComentarios} comentários.`,
                tipo: 'comentarios',
                link: `/recursos/${recurso._id}`,
                dataCriacao: agora,
                autorNome: 'Sistema'
            }, {
                titulo: 'Recurso mais comentado',
                tipo: 'comentarios',
                link: `/recursos/${recurso._id}`,
                dataCriacao: { $gte: hoje }
            });
        }
    }

    const destaqueTipoPipeline = [];
    if (desde) {
        destaqueTipoPipeline.push({ $match: { dataRegisto: { $gte: desde } } });
    }
    destaqueTipoPipeline.push(
        { $group: { _id: '$tipo', total: { $sum: 1 } } },
        { $sort: { total: -1 } },
        { $limit: 1 }
    );

    const destaqueTipo = await Recurso.aggregate(destaqueTipoPipeline);

    if (destaqueTipo.length > 0) {
        const tipo = await TipoRecurso.findOne({ slug: destaqueTipo[0]._id }).select('nome slug');
        await atualizarNoticiaAutomatica({
            titulo: 'Tipo em destaque',
            tipo: 'tipo_destaque',
            link: '/recursos'
        }, {
            titulo: 'Tipo em destaque',
            conteudo: `${tipo ? tipo.nome : destaqueTipo[0]._id} lidera com ${destaqueTipo[0].total} novos recursos esta semana.`,
            tipo: 'tipo_destaque',
            link: '/recursos',
            autorNome: 'Sistema'
        });
    }

    const totalRecursos = await Recurso.countDocuments();
    const totalTipos = await TipoRecurso.countDocuments({ ativo: true });
    const mediaEstrelas = await Recurso.aggregate([
        { $group: { _id: null, media: { $avg: '$mediaEstrelas' } } }
    ]);

    await atualizarNoticiaAutomatica({
        titulo: 'Estatísticas da plataforma',
        tipo: 'stats',
        link: '/recursos'
    }, {
        titulo: 'Estatísticas da plataforma',
        conteudo: `${totalRecursos} recursos publicados em ${totalTipos} tipos ativos. Média global de ${Number(mediaEstrelas[0]?.media || 0).toFixed(1)} estrelas.`,
        tipo: 'stats',
        link: '/recursos',
        autorNome: 'Sistema'
    });

    if (totalRecursos > 0 && totalRecursos % 10 === 0) {
        await criarNoticiaSeNaoExistir({
            titulo: 'Marco da plataforma',
            conteudo: `A plataforma atingiu ${totalRecursos} recursos.`,
            tipo: 'milestone',
            link: '/recursos',
            dataCriacao: agora,
            autorNome: 'Sistema'
        }, {
            titulo: 'Marco da plataforma',
            tipo: 'milestone',
            conteudo: `A plataforma atingiu ${totalRecursos} recursos.`
        });
    }
}

const noticiasController = {
    // GET /noticias
    getAllNoticias: async (req, res) => {
        try {
            await gerarNoticiasAutomaticas(parsePositiveInt(req.query.dias));

            const noticias = await Noticia.find({})
                .sort({ dataCriacao: -1 });
            res.json(noticias);
        } catch (err) {
            res.status(500).json({ erro: err.message });
        }
    },

    // GET /noticias/latest
    getLatestNoticias: async (req, res) => {
        try {
            const dias = parsePositiveInt(req.query.dias);
            if (!dias) return res.status(400).json({ erro: 'Parametro dias obrigatório' });

            await gerarNoticiasAutomaticas(dias);

            const limit = parsePositiveInt(req.query.limit);
            const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);

            const query = Noticia.find({ dataCriacao: { $gte: desde } })
                .sort({ dataCriacao: -1 });
            if (limit) query.limit(limit);

            const noticias = await query;

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

            const tipoNoticia = tipo || (req.user && req.user.role === 'admin' ? 'admin' : 'sistema');
            if (!TIPOS_NOTICIA.includes(tipoNoticia)) {
                return res.status(400).json({ erro: 'Tipo de notícia inválido' });
            }

            const noticia = await Noticia.create({ titulo, conteudo, tipo: tipoNoticia, link, autorNome });
            res.status(201).json(noticia);
        } catch (err) {
            res.status(500).json({ erro: err.message });
        }
    }
};

module.exports = noticiasController;
