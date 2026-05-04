const Recurso = require('../models/recurso');

/**
 * Serviço: Verificação de Permissões para Disseminação
 * Verifica se um utilizador pode exportar um recurso baseado na política de visibilidade
 */
class VerificacaoPermissoes {
    
    /**
     * Verifica se um utilizador pode exportar um recurso
     * @param {string} recursoId - ID do Recurso
     * @param {string} utilizadorId - ID do Utilizador
     * @param {string} papelUtilizador - Papel do utilizador ('admin', 'produtor', 'consumidor')
     * @returns {Promise<{temPermissao: boolean, motivo?: string}>}
     */
    async podeExportarRecurso(recursoId, utilizadorId, papelUtilizador) {
        try {
            const recurso = await Recurso.findById(recursoId)
                .populate('autor', 'id');
            
            if (!recurso) {
                return {
                    temPermissao: false,
                    motivo: 'Recurso não encontrado'
                };
            }
            
            // Admin pode sempre exportar
            if (papelUtilizador === 'admin') {
                return { temPermissao: true };
            }
            
            // Público: qualquer um pode exportar
            if (recurso.visibilidade === 'publico') {
                return { temPermissao: true };
            }
            
            // Privado: apenas produtor
            if (recurso.visibilidade === 'privado') {
                const ehProdutor = String(recurso.autor._id) === String(utilizadorId);
                if (ehProdutor) {
                    return { temPermissao: true };
                } else {
                    return {
                        temPermissao: false,
                        motivo: 'Recurso é privado e você não é o produtor'
                    };
                }
            }
            
            return {
                temPermissao: false,
                motivo: 'Política de visibilidade desconhecida'
            };
            
        } catch (err) {
            console.error('Erro em podeExportarRecurso:', err);
            throw err;
        }
    }
    
    /**
     * Filtra ficheiros baseado na visibilidade (DIP v1 ≈ SIP)
     * @param {object} aip - AIP com ficheiros
     * @param {string} utilizadorId - ID do utilizador
     * @param {string} papelUtilizador - Papel do utilizador
     * @returns {Promise<{ficheirosIncluidos: array, ficheirosExcluidos: array}>}
     */
    async filtrarFicheirosParaDIP(aip, utilizadorId, papelUtilizador) {
        try {
            const recurso = await Recurso.findById(aip.recursoId);
            
            if (!recurso) {
                throw new Error('Recurso não encontrado');
            }
            
            // v1: Todos os ficheiros são incluídos se utilizador tem acesso ao recurso
            const manifesto = aip.manifesto || {};
            const ficheirosManifesto = manifesto.files || [];
            
            const ficheirosIncluidos = ficheirosManifesto.map(f => ({
                name: f.name,
                size: f.size,
                type: f.type,
                required: f.required,
                checksum_sha256: f.checksum_sha256 || 'pendente',
                incluido_no_dip: true
            }));
            
            const ficheirosExcluidos = [];
            
            return {
                ficheirosIncluidos,
                ficheirosExcluidos,
                politicaAplicada: {
                    visibilidade: recurso.visibilidade,
                    ficheirosIncluidos: ficheirosIncluidos.length,
                    ficheirosExcluidos: ficheirosExcluidos.length
                }
            };
            
        } catch (err) {
            console.error('Erro em filtrarFicheirosParaDIP:', err);
            throw err;
        }
    }
    
}

module.exports = new VerificacaoPermissoes();
