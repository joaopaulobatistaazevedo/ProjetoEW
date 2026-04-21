const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'jcr_secret_2026';

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
            role: payload.role
        };
        return next();
    } catch (err) {
        return res.status(401).json({ erro: 'Token invalido ou expirado' });
    }
}

function authorize(...roles) {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ erro: 'Sem permissao' });
        }
        return next();
    };
}

module.exports = { authenticate, authorize };