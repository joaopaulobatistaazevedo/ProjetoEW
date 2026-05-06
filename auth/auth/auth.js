// Auth helpers (JWT + roles)
const jwt = require('jsonwebtoken');

const JWT_SECRET  = process.env.JWT_SECRET  || "jcr_secret_2026";
const COOKIE_NAME = process.env.COOKIE_NAME || "auth_token_alunos";

// --- Helpers para verificar role com hierarquia ---
// Admin > Produtor > Consumidor
function isAdmin(role) {
    return role === 'admin';
}

function isProdutor(role) {
    return role === 'produtor' || role === 'admin';
}

function isConsumidor(role) {
    return role === 'consumidor' || role === 'produtor' || role === 'admin';
}

// --- Middleware de Autenticação ---

// Verifica token por Header, Cookie ou Query
module.exports.verificaAcesso = (req, res, next) => {
    let token = null;

    if (req.headers['authorization']) {
        token = req.headers['authorization'].split(' ')[1];
    } else if (req.cookies && req.cookies[COOKIE_NAME]) {
        token = req.cookies[COOKIE_NAME];
    } else if (req.query && req.query.token) {
        token = req.query.token;
    }

    if (!token) {
        return res.status(401).json({ erro: "Acesso negado. Token não fornecido." });
    }

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = payload;
        next();
    } catch (err) {
        return res.status(401).json({ erro: "Token inválido ou expirado." });
    }
};

// --- Middleware de Autorização ---

// Verifica se o utilizador é admin
module.exports.verificaAdmin = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ erro: "Utilizador não autenticado." });
    }
    if (!isAdmin(req.user.role)) {
        return res.status(403).json({ erro: "Apenas administradores podem executar esta ação." });
    }
    next();
};

// Verifica se o utilizador é produtor ou admin
module.exports.verificaProdutor = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ erro: "Utilizador não autenticado." });
    }
    if (!isProdutor(req.user.role)) {
        return res.status(403).json({ erro: "Apenas produtores podem executar esta ação." });
    }
    next();
};

// Verifica se o utilizador é o autor do recurso (produtor/admin) OU é admin
module.exports.verificaAutor = (recurso) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ erro: "Utilizador não autenticado." });
        }
        
        // Admin pode alterar tudo
        if (isAdmin(req.user.role)) {
            return next();
        }
        
        // Produtor só pode alterar seus recursos
        // Comparar req.user.sub (ID do user) com recurso.autor (ID do autor)
        if (recurso && recurso.autor && recurso.autor.toString() === req.user.sub) {
            return next();
        }
        
        return res.status(403).json({ erro: "Você só pode editar seus próprios recursos." });
    };
};

// Consumidor — qualquer utilizador autenticado
module.exports.verificaConsumidor = (req, res, next) => {
    if (!req.user) {
        return res.status(401).json({ erro: "Utilizador não autenticado." });
    }
    next();
};

module.exports.isAdmin = isAdmin;
module.exports.isProdutor = isProdutor;
module.exports.isConsumidor = isConsumidor;
