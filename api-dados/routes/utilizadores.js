const express = require('express');
const router = express.Router();
const utilizadoresController = require('../controllers/utilizadoresController');

// GET /utilizadores - listar todos
router.get('/', utilizadoresController.getAllUtilizadores);

// POST /utilizadores - criar utilizador
router.post('/', utilizadoresController.createUtilizador);

// GET /utilizadores/:id - ver um utilizador
router.get('/:id', utilizadoresController.getUtilizadorById);

// PUT /utilizadores/:id - editar utilizador
router.put('/:id', utilizadoresController.updateUtilizador);

// DELETE /utilizadores/:id - apagar utilizador
router.delete('/:id', utilizadoresController.deleteUtilizador);

module.exports = router;