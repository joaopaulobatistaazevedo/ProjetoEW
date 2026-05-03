const express = require('express');
const router = express.Router();
const recursosController = require('../controllers/recursosController');
const upload = require('../middleware/upload');
const { authenticate, authorize } = require('../middleware/auth');

// GET /recursos — listar com filtros (público)
router.get('/', recursosController.getAllRecursos);

// GET /recursos/top3 — top 3 por média de estrelas (público)
router.get('/top3', recursosController.getTop3Recursos);

// GET /recursos/:id/download — autenticado, respeita visibilidade
router.get('/:id/download', authenticate, recursosController.downloadRecurso);

// POST /recursos — criar (qualquer autenticado, será promovido a produtor)
router.post('/', authenticate, upload.single('ficheiro'), recursosController.createRecurso);

// GET /recursos/:id — detalhe (público)
router.get('/:id', recursosController.getRecursoById);

// PUT /recursos/:id — editar (admin ou produtor dono)
router.put('/:id', authenticate, recursosController.updateRecurso);

// DELETE /recursos/:id — apagar (admin ou produtor dono)
router.delete('/:id', authenticate, recursosController.deleteRecurso);

// PATCH /recursos/:id/rate — avaliar (autenticado)
router.patch('/:id/rate', authenticate, recursosController.rateRecurso);

module.exports = router;