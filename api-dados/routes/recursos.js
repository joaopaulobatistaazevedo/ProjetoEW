const express = require('express');
const router = express.Router();
const recursosController = require('../controllers/recursosController');
// Upload de ficheiro do recurso
const { uploadRecursos } = require('../middleware/uploads');
const { authenticate, authorize } = require('../middleware/auth');

// GET /recursos — listar com filtros (público)
router.get('/', recursosController.getAllRecursos);

// GET /recursos/top3 — top 3 por média de estrelas (público)
router.get('/top3', recursosController.getTop3Recursos);

// GET /recursos/:id/download — autenticado, respeita visibilidade
router.get('/:id/download', authenticate, recursosController.downloadRecurso);

// GET /recursos/:id/preview — devolve o ficheiro para visualização inline
router.get('/:id/preview', recursosController.previewRecurso);

// Conditional upload middleware: only invoke multer for multipart/form-data
function conditionalUpload(req, res, next) {
	const ct = (req.headers['content-type'] || '').toLowerCase();
	if (ct.startsWith('multipart/form-data')) {
		return uploadRecursos.fields([
			{ name: 'ficheiro', maxCount: 1 },
			{ name: 'ficheirosNovos', maxCount: 20 }
		])(req, res, next);
	}
	return next();
}

// POST /recursos — criar (qualquer autenticado, será promovido a produtor)
router.post('/', authenticate, conditionalUpload, recursosController.createRecurso);

// GET /recursos/:id — detalhe (público)
router.get('/:id', recursosController.getRecursoById);

// PUT /recursos/:id — editar (admin ou produtor dono)
router.put('/:id', authenticate, conditionalUpload, recursosController.updateRecurso);

// DELETE /recursos/:id — apagar (admin ou produtor dono)
router.delete('/:id', authenticate, recursosController.deleteRecurso);

// PATCH /recursos/:id/rate — avaliar (autenticado)
router.patch('/:id/rate', authenticate, recursosController.rateRecurso);

module.exports = router;
