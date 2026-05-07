const express = require('express');
const router = express.Router();
const tiposRecursoController = require('../controllers/tiposRecursoController');
const { authenticate, authorize } = require('../middleware/auth');

router.get('/', tiposRecursoController.getTiposAtivos);
router.get('/todos', authenticate, authorize('admin'), tiposRecursoController.getTodosTipos);
router.post('/', authenticate, authorize('admin'), tiposRecursoController.createTipo);
router.put('/:id', authenticate, authorize('admin'), tiposRecursoController.updateTipo);

module.exports = router;
