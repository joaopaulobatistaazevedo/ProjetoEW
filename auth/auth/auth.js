const jwt = require('jsonwebtoken');

const JWT_SECRET  = process.env.JWT_SECRET  || "jcr_secret_2026";
const COOKIE_NAME = process.env.COOKIE_NAME || "auth_token_alunos";

// Middleware — verifica o token por Header, Cookie ou Query String
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