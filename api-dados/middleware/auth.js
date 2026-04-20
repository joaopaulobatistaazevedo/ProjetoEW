// const jwt = require('jsonwebtoken');
// const SECRET = process.env.JWT_SECRET || 'segredo';

// function authenticate(req, res, next) {
//     const token = req.headers.authorization?.split(' ')[1]; // Bearer <token>
//     if (!token) return res.status(401).json({ erro: 'Token em falta' });

//     try {
//         req.user = jwt.verify(token, SECRET);
//         next();
//     } catch (err) {
//         res.status(401).json({ erro: 'Token inválido ou expirado' });
//     }
// }

// function authorize(...roles) {
//     return (req, res, next) => {
//         if (!roles.includes(req.user.role))
//             return res.status(403).json({ erro: 'Sem permissão' });
//         next();
//     };
// }

// module.exports = { authenticate, authorize };