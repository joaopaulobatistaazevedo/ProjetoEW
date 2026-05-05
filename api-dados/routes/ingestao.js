const express = require('express');
const router = express.Router();
const ingestaoController = require('../controllers/ingestaoController');
const uploadZip = require('../middleware/uploadZip');
const { authenticate, authorize } = require('../middleware/auth');

// POST /ingestao/sip — submeter SIP (autenticado, qualquer utilizador)
router.post('/sip', authenticate, uploadZip.single('file'), ingestaoController.submeterSIP);

// GET /ingestao/aips — listar AIPs do utilizador
router.get('/aips', authenticate, ingestaoController.listarAIPs);

// GET /ingestao/aips/:sipId — detalhe de um AIP
router.get('/aips/:sipId', authenticate, ingestaoController.detalheAIP);

// GET /ingestao/aips/:sipId/relatorio — relatório de validação
router.get('/aips/:sipId/relatorio', authenticate, ingestaoController.relatorioAIP);

module.exports = router;
