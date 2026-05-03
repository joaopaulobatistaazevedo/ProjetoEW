const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'jcr_secret_2026';

// Hierarquia de roles: admin > produtor > consumidor
function isAdmin(role) {
    return role === 'admin';
}

function isProdutor(role) {
    return role === 'produtor' || role === 'admin';
}

function isConsumidor(role) {
    return role === 'consumidor' || role === 'produtor' || role === 'admin';
}

function authenticate(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
        return res.status(401).json({ erro: 'Token em falta' });
    }

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        req.user = {
            id: payload.id || payload.sub,
            username: payload.username,
            nome: payload.nome,
            role: payload.role
        };
        return next();
    } catch (err) {
        return res.status(401).json({ erro: 'Token invalido ou expirado' });
    }
}

// Autorização por role: admin > produtor > consumidor
function authorize(...roles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ erro: 'Utilizador não autenticado' });
        }
        
        // Verificar se o role é permitido (com hierarquia)
        const permitido = roles.some(role => {
            if (role === 'admin') return isAdmin(req.user.role);
            if (role === 'produtor') return isProdutor(req.user.role);
            if (role === 'consumidor') return isConsumidor(req.user.role);
            return false;
        });
        
        if (!permitido) {
            return res.status(403).json({ erro: 'Sem permissão' });
        }
        return next();
    };
}

module.exports = { authenticate, authorize, isAdmin, isProdutor, isConsumidor };