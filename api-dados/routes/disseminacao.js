const express = require('express');
const router = express.Router();
const disseminacaoController = require('../controllers/disseminacaoController');
// Auth + permissao para exportacao
const { authenticate } = require('../middleware/auth');
const verificarPermissaoExportacao = require('../middleware/verificarPermissaoExportacao');

/**
 * ENDPOINTS DE DISSEMINAÇÃO (DIP)
 * 
 * Base: /disseminacao
 */

/**
 * GET /disseminacao/recursos/{recursoId}/exportar
 * Exporta um recurso individual como DIP-ZIP
 * Respeitando política de visibilidade
 */
router.get(
    '/recursos/:recursoId/exportar',
    authenticate,
    verificarPermissaoExportacao,
    disseminacaoController.exportarRecurso
);

/**
 * GET /disseminacao/recursos/exportar-multiplos
 * Exporta múltiplos recursos numa única operação
 * Query: ?ids=507f1f77bcf86cd799439011,508a8f88dce97de899540122
 */
router.get(
    '/recursos/exportar-multiplos',
    authenticate,
    disseminacaoController.exportarMultiplos
);

/**
 * GET /disseminacao/recursos/{recursoId}/historico-exportacoes
 * Lista histórico de exportações (auditoria)
 * Apenas produtor ou admin podem consultar
 */
router.get(
    '/recursos/:recursoId/historico-exportacoes',
    authenticate,
    verificarPermissaoExportacao,
    disseminacaoController.historicoExportacoes
);

/**
 * GET /disseminacao/meus-recursos/exportar-todos
 * Exporta todos os recursos do utilizador autenticado
 * Apenas para autenticados
 */
router.get(
    '/meus-recursos/exportar-todos',
    authenticate,
    disseminacaoController.exportarTodosRecursos
);

/**
 * GET /disseminacao/recursos/:recursoId/exportar-flexivel
 * Exporta com opções: ?modo=completo|subconjunto|individual&ficheiros=file1.pdf,file2.docx
 */
router.get(
    '/recursos/:recursoId/exportar-flexivel',
    authenticate,
    verificarPermissaoExportacao,
    disseminacaoController.exportarComOpcoes
);

module.exports = router;
