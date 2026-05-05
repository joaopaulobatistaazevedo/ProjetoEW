const verificacaoPermissoes = require('../services/verificacaoPermissoes');

/**
 * Middleware: Verifica se o utilizador tem permissão para exportar um recurso
 * Usa o serviço de verificação de permissões
 */
async function verificarPermissaoExportacao(req, res, next) {
    try {
        // Inputs from route and auth context
        const { recursoId } = req.params;
        const utilizadorId = req.user.id;
        const papelUtilizador = req.user.role || 'consumidor';
        
        // Delegate policy check to service
        const { temPermissao, motivo } = await verificacaoPermissoes.podeExportarRecurso(
            recursoId,
            utilizadorId,
            papelUtilizador
        );
        
        if (!temPermissao) {
            const statusCode = motivo === 'Recurso não encontrado' ? 404 : 403;
            return res.status(statusCode).json({
                status: 'erro',
                mensagem: motivo || 'Não tem permissão para exportar este recurso'
            });
        }
        
        // Authorized
        next();
        
    } catch (err) {
        console.error('Erro em verificarPermissaoExportacao:', err);
        res.status(500).json({
            status: 'erro',
            mensagem: 'Erro ao verificar permissão'
        });
    }
}

module.exports = verificarPermissaoExportacao;
