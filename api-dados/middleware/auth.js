// JWT auth helpers
const jwt = require('jsonwebtoken');

// Fallback secret para ambiente local
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

// Extract token and attach req.user
function authenticate(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
        return res.status(401).json({ erro: 'Token em falta' });
    }

    try {
        const payload = jwt.verify(token, JWT_SECRET);
        // Normalize payload into req.user
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
// Role-based access control with hierarchy
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