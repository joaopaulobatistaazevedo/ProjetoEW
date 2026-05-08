const express = require('express');
const router = express.Router();
const noticiasController = require('../controllers/noticiasController');
const { authenticate, authorize } = require('../middleware/auth');

const INTERNAL_NEWS_SECRET = process.env.INTERNAL_NEWS_SECRET || 'internal_news_secret_2026';

function verificarSegredoInterno(req, res, next) {
	const segredo = req.headers['x-internal-news-secret'];
	if (!segredo || segredo !== INTERNAL_NEWS_SECRET) {
		return res.status(403).json({ erro: 'Sem permissão' });
	}
	return next();
}

// GET /noticias - lista publica (limit opcional)
router.get('/', noticiasController.getAllNoticias);

// POST /noticias - criar noticia (apenas admin)
router.post('/', authenticate, authorize('admin'), noticiasController.createNoticia);

// POST /noticias/internal - criar noticia automática (serviços internos)
router.post('/internal', verificarSegredoInterno, noticiasController.createNoticia);

module.exports = router;
