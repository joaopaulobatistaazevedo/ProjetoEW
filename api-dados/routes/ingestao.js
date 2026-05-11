const express = require('express');
const router = express.Router();
const ingestaoController = require('../controllers/ingestaoController');
// Upload de SIP em ZIP
const { uploadSipZip, uploadMultipleFiles } = require('../middleware/uploads');
const { authenticate, authorize } = require('../middleware/auth');

// POST /ingestao/sip — submeter SIP (autenticado, qualquer utilizador)
//  único caminho para recursos com ficheiros
router.post('/sip', authenticate, uploadSipZip.single('file'), ingestaoController.submeterSIP);

// POST /ingestao/form — submeter via formulário assistido
// Recebe metadados + múltiplos ficheiros, gera SIP internamente
router.post('/form', authenticate, uploadMultipleFiles.array('ficheiros', 20), ingestaoController.submeterFormulario);

// GET /ingestao/aips — listar AIPs do utilizador
router.get('/aips', authenticate, ingestaoController.listarAIPs);

// GET /ingestao/aips/:sipId — detalhe de um AIP
router.get('/aips/:sipId', authenticate, ingestaoController.detalheAIP);

// GET /ingestao/aips/:sipId/relatorio — relatório de validação
router.get('/aips/:sipId/relatorio', authenticate, ingestaoController.relatorioAIP);

// GET /ingestao/recursos/:recursoId/historico-aip — histórico de versões
router.get('/recursos/:recursoId/historico-aip', authenticate, ingestaoController.historicoAIP);

module.exports = router;
