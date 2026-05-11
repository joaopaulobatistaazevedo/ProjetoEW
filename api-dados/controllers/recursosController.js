const path = require('path');
const fs = require('fs');
const Recurso = require('../models/recurso');
const Noticia = require('../models/noticia');
const AIP = require('../models/aip');
const { obterTipoAtivoPorSlug, enriquecerComTipos } = require('../services/tiposRecursoService');
const {
    normalizarHashtags,
    normalizarLista,
    sanitizarSegmentoCaminho,
    ficheirosRecebidos,
    calcularChecksumBuffer,
    gerarSipIdVersao
} = require('../utils/controllerUtils');
const AdmZip = require('adm-zip');
const zip = new AdmZip();

async function criarNovaVersaoAIPDoRecurso(recurso, utilizadorId, ficheirosRemoverIds, novosFicheiros) {
    const aipAnterior = await AIP.findOne({ recursoId: recurso._id })
        .sort({ versao: -1 });

    if (!aipAnterior) {
        throw new Error('Nenhum AIP existente para este recurso');
    }

    const novaVersao = (aipAnterior.versao || 1) + 1;
    const storageLocal = path.join(__dirname, '..', 'uploads');

    const idsRemover = new Set(ficheirosRemoverIds.map(String));
    const ficheirosMantidos = (recurso.ficheiros || []).filter(f => !idsRemover.has(String(f._id)));
    const ficheirosFinal = [];
    const manifestoFiles = [];

    for (const ficheiro of ficheirosMantidos) {
        const nome = sanitizarSegmentoCaminho(ficheiro.nome);
        const checksum = ficheiro.checksum;
        const tamanho = ficheiro.tamanho || 0;

        ficheirosFinal.push({
            nome,
            caminho: ficheiro.caminho,
            tamanho,
            tipo: ficheiro.tipo || 'application/octet-stream',
            checksum,
            dataAdicionado: ficheiro.dataAdicionado || new Date(),
            versaoAIP: ficheiro.versaoAIP || aipAnterior.versao || 1
        });

        manifestoFiles.push({
            name: nome,
            path: ficheiro.caminho,
            size: tamanho,
            type: ficheiro.tipo || 'application/octet-stream',
            checksum_sha256: checksum,
            required: false
        });
    }

    for (const file of novosFicheiros) {
        const nome = sanitizarSegmentoCaminho(file.originalname);
        const caminho = file.path
            ? path.join('/uploads', path.basename(file.path))
            : path.join('/uploads', nome);
        const conteudo = file.buffer || fs.readFileSync(file.path);
        const checksum = calcularChecksumBuffer(conteudo);
        const tipo = file.mimetype || 'application/octet-stream';

        ficheirosFinal.push({
            nome,
            caminho,
            tamanho: conteudo.length,
            tipo,
            checksum,
            dataAdicionado: new Date(),
            versaoAIP: novaVersao
        });

        manifestoFiles.push({
            name: nome,
            path: caminho,
            size: conteudo.length,
            type: tipo,
            checksum_sha256: checksum,
            required: false
        });
    }

    const manifestoAnterior = aipAnterior.manifesto || {};
    const manifesto = {
        ...manifestoAnterior,
        titulo: recurso.titulo,
        subtitulo: recurso.subtitulo || '',
        descricao: recurso.descricao || '',
        tipo: recurso.tipo,
        dataCriacao: recurso.dataCriacao,
        visibilidade: recurso.visibilidade,
        hashtags: recurso.hashtags || [],
        editado: true,
        aipAnterior: String(aipAnterior._id),
        files: manifestoFiles
    };

    const novoAIP = await AIP.create({
        sipId: await gerarSipIdVersao(aipAnterior, novaVersao, (id) => AIP.findById(id)),
        recursoId: recurso._id,
        versao: novaVersao,
        aipAnterior: aipAnterior._id,
        motivoAtualizacao: novosFicheiros.length || ficheirosRemoverIds.length
            ? 'ficheiro_corrigido'
            : 'metadados_atualizados',
        status: 'ok',
        dataIngestao: new Date(),
        produtor: utilizadorId,
        manifesto,
        validacoes: {
            estrutura: { ok: true },
            metadados: { ok: true },
            seguranca: { ok: true },
            consistencia: { ok: true }
        },
        storageLocal,
        relatorio: {
            dataValidacao: new Date(),
            erros: [],
            avisos: [`Nova versão criada na edição do recurso: v${novaVersao}`]
        },
        checksumSIP: aipAnterior.checksumSIP,
        downloadCount: 0
    });

    return { novoAIP, ficheirosFinal };
}

const recursosController = {

    // GET /recursos — listar com filtros (público)
    getAllRecursos: async (req, res) => {
        try {
            const { q, tipo, hashtag, ano, visibilidade, autor, produtor, sort, order, limit, page } = req.query;
            const filtro = {};

            if (q)               filtro.$text = { $search: q };
            if (tipo)         filtro.tipo = tipo;
            if (visibilidade) filtro.visibilidade = visibilidade;
            if (hashtag)      filtro.hashtags = hashtag;
            if (autor || produtor) filtro.autor = autor || produtor;
            if (ano)          filtro.dataCriacao = {
                $gte: new Date(`${ano}-01-01`),
                $lte: new Date(`${ano}-12-31`)
            };

            // Ordenacao com ranking opcional por relevancia
            let sortObj = { dataRegisto: -1 };
            const ord = order === 'asc' ? 1 : -1;
            if (sort === 'mediaEstrelas') sortObj = { mediaEstrelas: ord };
            else if (sort === 'dataRegisto') sortObj = { dataRegisto: ord };
            else if (sort === 'relevancia' || q) sortObj = q
                ? { score: { $meta: 'textScore' }, mediaEstrelas: -1, dataRegisto: -1 }
                : { mediaEstrelas: -1, dataRegisto: -1 };

            const lim = parseInt(limit) || 50;
            const pg = parseInt(page) > 0 ? parseInt(page) : 1;
            const skip = (pg - 1) * lim;

            // Query base com populate e pagina
            const query = Recurso.find(filtro)
                .populate('autor', 'nome email')
                .sort(sortObj)
                .skip(skip)
                .limit(lim);

            if (q) {
                query.select({ score: { $meta: 'textScore' } });
            }

            const recursos = await query;

            res.json(await enriquecerComTipos(recursos));
        } catch (err) {
            res.status(500).json({ erro: err.message });
        }
    },

    // GET /recursos/top3 — top 3 por média de estrelas (público)
    getTop3Recursos: async (req, res) => {
        try {
            const top3 = await Recurso.find({ visibilidade: 'publico' })
                .sort({ mediaEstrelas: -1 })
                .limit(3)
                .populate('autor', 'nome');

            res.json(await enriquecerComTipos(top3));
        } catch (err) {
            res.status(500).json({ erro: err.message });
        }
    },

    // GET /recursos/:id — detalhe (público)
    getRecursoById: async (req, res) => {
        try {
            const recurso = await Recurso.findById(req.params.id)
                .populate('autor', 'nome email');

            if (!recurso) return res.status(404).json({ erro: 'Recurso não encontrado' });
            res.json(await enriquecerComTipos(recurso));
        } catch (err) {
            res.status(500).json({ erro: err.message });
        }
    },

    // GET /recursos/:id/download — retorna ZIP com todos os ficheiros do recurso
    downloadRecurso: async (req, res) => {
        try {
            const recurso = await Recurso.findById(req.params.id);
            if (!recurso) return res.status(404).json({ erro: 'Recurso não encontrado' });
            if (!recurso.ficheiros || recurso.ficheiros.length === 0) {
                return res.status(404).json({ erro: 'Sem ficheiros associados' });
            }

            // Privado: apenas admin ou autor
            if (recurso.visibilidade === 'privado') {
                if (req.user.role !== 'admin' && req.user.id !== recurso.autor.toString()) {
                    return res.status(403).json({ erro: 'Sem permissão' });
                }
            }

            // Criar ZIP com todos os ficheiros
            
            for (const ficheiro of recurso.ficheiros) {
                try {
                    const caminhoFicheiro = path.resolve(ficheiro.caminho);
                    zip.addFile(path.basename(ficheiro.caminho), require('fs').readFileSync(caminhoFicheiro));
                } catch (err) {
                    console.error(`Erro ao adicionar ${ficheiro.nome} ao ZIP:`, err.message);
                    // Continuar com próximos ficheiros
                }
            }

            // Enviar ZIP
            const zipBuffer = zip.toBuffer();
            res.setHeader('Content-Type', 'application/zip');
            res.setHeader('Content-Disposition', `attachment; filename="recurso_${recurso._id}.zip"`);
            res.send(zipBuffer);
        } catch (err) {
            res.status(500).json({ erro: err.message });
        }
    },

    // GET /recursos/:id/preview — retorna JSON com lista de todos os ficheiros
    previewRecurso: async (req, res) => {
        try {
            const recurso = await Recurso.findById(req.params.id);
            if (!recurso) return res.status(404).json({ erro: 'Recurso não encontrado' });
            if (!recurso.ficheiros || recurso.ficheiros.length === 0) {
                return res.status(404).json({ erro: 'Sem ficheiros associados' });
            }

            // Retornar lista com metadados de todos os ficheiros
            const ficheirosList = recurso.ficheiros.map((f, idx) => ({
                indice: idx,
                nome: f.nome,
                tamanho: f.tamanho,
                tipo: f.tipo,
                checksum_sha256: f.checksum,
                dataAdicionado: f.dataAdicionado,
                versaoAIP: f.versaoAIP,
                downloadUrl: `/recursos/${recurso._id}/ficheiro/${idx}`  // Para próxima fase
            }));

            res.json({
                recursoId: recurso._id,
                titulo: recurso.titulo,
                ficheiros: ficheirosList,
                totalFicheiros: ficheirosList.length
            });
        } catch (err) {
            res.status(500).json({ erro: err.message });
        }
    },

    // POST /recursos — criar (apenas metadados administrativos, sem ficheiro)
    //  Recursos com ficheiros DEVEM ser criados via POST /ingestao/sip
    createRecurso: async (req, res) => {
        try {
            // Rejeitar criação direta de recursos com ficheiro
            if (ficheirosRecebidos(req).length > 0) {
                return res.status(403).json({
                    erro: 'Recursos com ficheiro devem ser criados via submissão de SIP',
                    dica: 'Utilize POST /ingestao/sip para submeter um SIP com ficheiros',
                    categoria: 'oais_architecture'
                });
            }

            const { titulo, subtitulo, tipo, dataCriacao, visibilidade, hashtags } = req.body;

            // Validações básicas
            if (!titulo || !tipo) return res.status(400).json({ erro: 'Titulo e tipo são obrigatórios' });

            const tipoPermitido = await obterTipoAtivoPorSlug(tipo);
            if (!tipoPermitido) {
                return res.status(400).json({ erro: 'Tipo de recurso invalido ou inativo.' });
            }

            const tags = normalizarHashtags(hashtags);

            // Garantir que ficheiros é array vazio (metadados apenas)
            const recurso = await Recurso.create({
                titulo,
                subtitulo,
                descricao: req.body.descricao,
                tipo: tipoPermitido.slug,
                dataCriacao: dataCriacao ? new Date(dataCriacao) : undefined,
                visibilidade,
                hashtags: tags,
                autor: req.user.id,
                ficheiros: []  // Sempre array vazio — ficheiros devem vir via SIP
            });

            // Promover utilizador a produtor se consumidor (nao bloqueia resposta)
            if (req.user.role === 'consumidor') {
                const axios = require('axios');
                const AUTH_SERVICE_URL = process.env.AUTH_URL || 'http://localhost:2623';
                const token = req.headers.authorization?.split(' ')[1];
                
                axios.put(
                    `${AUTH_SERVICE_URL}/users/${req.user.id}/promote/produtor`,
                    {},
                    { headers: { Authorization: `Bearer ${token}` } }
                ).catch(err => console.error('Erro ao promover para produtor:', err.message));
            }

            // Criar notícia de nova submissão (melhor esforço)
            try {
                const autorNome = req.user && (req.user.nome || req.user.username) ? (req.user.nome || req.user.username) : 'Um utilizador';
                await Noticia.create({
                    titulo: 'Novo recurso adicionado',
                    conteudo: `O produtor ${autorNome} submeteu o recurso "${recurso.titulo}".`,
                    tipo: 'novo_recurso',
                    link: `/recursos/${recurso._id}`,
                    autorNome
                });
            } catch (e) {
                console.warn('Não foi possível registar notícia de submissão:', e.message);
            }

            res.status(201).json(await enriquecerComTipos(recurso));
        } catch (err) {
            console.error('Erro em createRecurso:', err && err.stack ? err.stack : err);
            res.status(500).json({ erro: err.message });
        }
    },

    // PUT /recursos/:id — editar (admin ou autor dono)
    // Permite atualizar ficheiro com versionamento de AIP
    updateRecurso: async (req, res) => {
        try {
            const recurso = await Recurso.findById(req.params.id);
            if (!recurso) return res.status(404).json({ erro: 'Recurso não encontrado' });

            if (req.user.role !== 'admin' && req.user.id !== recurso.autor.toString()) {
                return res.status(403).json({ erro: 'Sem permissão' });
            }

            // Sanitizar e validar campos atualizaveis (metadados)
            const allowed = ['titulo','subtitulo','descricao','tipo','dataCriacao','visibilidade','hashtags'];
            const update = {};
            for (const k of allowed) {
                if (req.body[k] !== undefined) update[k] = req.body[k];
            }
            if (update.hashtags !== undefined) {
                update.hashtags = normalizarHashtags(update.hashtags);
            }

            if (update.dataCriacao) update.dataCriacao = new Date(update.dataCriacao);

            if (update.tipo !== undefined) {
                const tipoPermitido = await obterTipoAtivoPorSlug(update.tipo);
                if (!tipoPermitido) {
                    return res.status(400).json({ erro: 'Tipo de recurso invalido ou inativo.' });
                }

                update.tipo = tipoPermitido.slug;
            }

            Object.assign(recurso, update);

            const ficheirosRemoverIds = normalizarLista(req.body.ficheirosRemover);
            const novosFicheiros = ficheirosRecebidos(req);

            let resultadoVersao = null;
            try {
                const { novoAIP, ficheirosFinal } = await criarNovaVersaoAIPDoRecurso(
                    recurso,
                    req.user.id,
                    ficheirosRemoverIds,
                    novosFicheiros
                );

                recurso.ficheiros = ficheirosFinal;
                resultadoVersao = {
                    aipId: novoAIP._id,
                    versao: novoAIP.versao,
                    sipId: novoAIP.sipId,
                    aipAnterior: novoAIP.aipAnterior
                };
            } catch (aipErr) {
                console.error('Erro ao criar versão AIP:', aipErr.message);
                return res.status(500).json({
                    erro: 'Erro ao criar nova versão AIP',
                    detalhes: aipErr.message,
                    categoria: 'oais_versionamento'
                });
            }

            const atualizado = await recurso.save();
            const resposta = await enriquecerComTipos(atualizado);
            
            if (resultadoVersao) {
                resposta._aipVersao = resultadoVersao;
            }
            
            res.json(resposta);
        } catch (err) {
            res.status(500).json({ erro: err.message });
        }
    },

    // DELETE /recursos/:id — apagar (admin ou autor dono)
    deleteRecurso: async (req, res) => {
        try {
            const recurso = await Recurso.findById(req.params.id);
            if (!recurso) return res.status(404).json({ erro: 'Recurso não encontrado' });

            if (req.user.role !== 'admin' && req.user.id !== recurso.autor.toString()) {
                return res.status(403).json({ erro: 'Sem permissão' });
            }

            await Recurso.findByIdAndDelete(req.params.id);
            res.json({ mensagem: 'Recurso eliminado' });
        } catch (err) {
            res.status(500).json({ erro: err.message });
        }
    },

    // PATCH /recursos/:id/rate — avaliar (autenticado)
    rateRecurso: async (req, res) => {
        try {
            const { estrelas } = req.body;
            if (!estrelas || estrelas < 1 || estrelas > 5)
                return res.status(400).json({ erro: 'Estrelas deve ser entre 1 e 5' });

            const recurso = await Recurso.findById(req.params.id);
            if (!recurso) return res.status(404).json({ erro: 'Recurso não encontrado' });

            // Atualiza rating existente ou cria novo
            const indice = recurso.ratings.findIndex(r => r.utilizador.toString() === req.user.id);
            if (indice >= 0) {
                recurso.ratings[indice].estrelas = estrelas;
            } else {
                recurso.ratings.push({ utilizador: req.user.id, estrelas });
            }

            await recurso.save();

            // Gerar notícia automática do top3 após mudança de ranking
            try {
                const top3 = await Recurso.find({ visibilidade: 'publico' })
                    .sort({ mediaEstrelas: -1 })
                    .limit(3)
                    .populate('autor', 'nome');

                const resumo = top3
                    .map((r, index) => `${index + 1}. ${r.titulo}`)
                    .join(' | ');

                await Noticia.create({
                    titulo: 'O novo top3 de recursos mais requisitados é ...',
                    conteudo: resumo || 'Ainda não existem recursos suficientes para construir o top3.',
                    tipo: 'trending',
                    link: '/recursos?sort=mediaEstrelas',
                    autorNome: 'Sistema'
                });
            } catch (noticiaErr) {
                console.warn('Não foi possível registar notícia do top3:', noticiaErr.message);
            }

            res.json({ mediaEstrelas: recurso.mediaEstrelas, totalVotos: recurso.ratings.length });
        } catch (err) {
            res.status(500).json({ erro: err.message });
        }
    }
};

module.exports = recursosController;
