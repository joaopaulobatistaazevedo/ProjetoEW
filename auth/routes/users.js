const express = require('express');
const router = express.Router();
const Utilizador = require('../controllers/utilizador');
const auth = require('../auth/auth');
const jwt = require('jsonwebtoken');
const axios = require('axios');

// Cookie onde o token e guardado
const COOKIE_NAME = process.env.COOKIE_NAME || "auth_token_alunos";
const JWT_SECRET = process.env.JWT_SECRET || "jcr_secret_2026";
const API_URL = process.env.API_URL || 'http://localhost:3001';
const INTERNAL_NEWS_SECRET = process.env.INTERNAL_NEWS_SECRET || 'internal_news_secret_2026';

// Remover campos sensiveis do output
function toPublicUser(userDoc) {
    if (!userDoc) return null;

    const user = userDoc.toObject ? userDoc.toObject() : userDoc;
    return {
        _id: user._id,
        username: user.username,
        nome: user.nome,
        email: user.email,
        role: user.role,
        filiacao: user.filiacao,
        dataRegisto: user.dataRegisto,
        dataUltimoAcesso: user.dataUltimoAcesso,
        ativo: user.ativo
    };
}

// --- ROTAS ABERTAS ---

// POST /users/register — criar conta
router.post('/register', async (req, res) => {
    try {
        // Criar conta com role consumidor por defeito
        const data = { ...req.body, role: 'consumidor' };
        const novo = await Utilizador.insert(data);

        // Criar notícia automática sobre o novo registo 
        try {
            await axios.post(`${API_URL}/noticias/internal`, {
                titulo: `Novo utilizador registado: ${novo.nome || novo.username}`,
                conteudo: `Foi registado mais um utilizador, o sistema tem agora ${novo.username}.`,
                tipo: 'sistema',
                autorNome: novo.nome || novo.username
            }, {
                headers: { 'X-Internal-News-Secret': INTERNAL_NEWS_SECRET }
            });
        } catch (noticiaErr) {
            console.warn('Não foi possível registar notícia de novo utilizador:', noticiaErr.message);
        }

        res.status(201).json(toPublicUser(novo));
    } catch (err) {
        res.status(400).json({ erro: err.message });
    }
});

// POST /users/login — autenticar
router.post('/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        const dados = await Utilizador.login(username, password);
        
        res.cookie(COOKIE_NAME, dados.token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 3600000
        });
        res.status(200).json({ status: "Login efetuado com sucesso", user: dados.user, token: dados.token });
    } catch (err) {
        res.status(401).json({ erro: err.message });
    }
});

// GET /users/logout — terminar sessão
router.get('/logout', (req, res) => {
    res.clearCookie(COOKIE_NAME);
    res.status(200).json({ status: "Sessão terminada" });
});

// --- ROTAS PROTEGIDAS ---

// GET /users — listar todos
router.get('/', auth.verificaAcesso, (req, res) => {
    Utilizador.list()
        .then(dados => res.status(200).json(dados))
        .catch(err => res.status(500).json({ erro: err.message }));
});

// GET /users/:id — ver um
router.get('/:id', auth.verificaAcesso, (req, res) => {
    Utilizador.findById(req.params.id)
        .then(dados => {
            if (dados) res.status(200).json(dados);
            else res.status(404).json({ erro: "Utilizador não encontrado" });
        })
        .catch(err => res.status(500).json({ erro: err.message }));
});

// PUT /users/:id — atualizar (admin ou o proprio utilizador)
router.put('/:id', auth.verificaAcesso, async (req, res) => {
    try {
        const isSelf = req.user.sub === req.params.id;
        const isAdmin = req.user.role === 'admin';

        // Só o próprio utilizador ou um admin podem atualizar o registo
        if (!isSelf && !isAdmin) {
            return res.status(403).json({ erro: 'Sem permissão' });
        }

        // Impedir que um admin altere a password de outro utilizador
        if (!isSelf && req.body && req.body.password) {
            delete req.body.password;
        }

        const updated = await Utilizador.update(req.params.id, req.body);
        res.status(200).json(toPublicUser(updated));
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// DELETE /users/:id — apagar (apenas admin, não pode apagar admin)
router.delete('/:id', auth.verificaAcesso, auth.verificaAdmin, async (req, res) => {
    try {
        // Impedir remoção de usuarios admin
        const user = await Utilizador.findById(req.params.id);
        if (user && user.role === 'admin') {
            return res.status(403).json({ erro: 'Nao pode eliminar usuarios com role admin.' });
        }
        const removed = await Utilizador.remove(req.params.id);
        res.status(200).json({ status: "Removido", dados: toPublicUser(removed) });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

// PUT /users/:id/promote/produtor — promover consumidor a produtor
router.put('/:id/promote/produtor', auth.verificaAcesso, async (req, res) => {
    try {
        // Só permite promover a si próprio, a menos que seja admin
        if (req.user.sub !== req.params.id && req.user.role !== 'admin') {
            return res.status(403).json({ erro: "Pode apenas promover-se a si próprio" });
        }
        const promovido = await Utilizador.promoteToProdutor(req.params.id);
        const token = jwt.sign(
            {
                sub: promovido._id.toString(),
                username: promovido.username,
                nome: promovido.nome,
                role: promovido.role
            },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        res.cookie(COOKIE_NAME, token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            maxAge: 3600000
        });

        res.status(200).json({ user: toPublicUser(promovido), token });
    } catch (err) {
        res.status(400).json({ erro: err.message });
    }
});

// PUT /users/:id/promote/admin — promover qualquer utilizador a admin (apenas admin)
router.put('/:id/promote/admin', auth.verificaAcesso, auth.verificaAdmin, async (req, res) => {
    try {
        const promovido = await Utilizador.promoteToAdmin(req.params.id);
        res.status(200).json(toPublicUser(promovido));
    } catch (err) {
        res.status(400).json({ erro: err.message });
    }
});

module.exports = router;