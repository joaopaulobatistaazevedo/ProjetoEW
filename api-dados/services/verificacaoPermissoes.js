const Recurso = require('../models/recurso');

function normalizarListaFicheiros(ficheirosSolicitados) {
    const lista = Array.isArray(ficheirosSolicitados)
        ? ficheirosSolicitados
        : typeof ficheirosSolicitados === 'string'
            ? ficheirosSolicitados.split(',')
            : [ficheirosSolicitados];

    return [...new Set(
        lista
            .filter(Boolean)
            .map(item => item.trim())
            .filter(Boolean)
    )];
}

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
     * Filtra ficheiros acessíveis e aplica seleção opcional do pedido DIP
     * @param {object} aip - AIP com ficheiros
     * @param {string} utilizadorId - ID do utilizador
     * @param {string} papelUtilizador - Papel do utilizador
     * @param {object} opcoes - Opções do pedido de disseminação
     * @returns {Promise<{ficheirosIncluidos: array, ficheirosExcluidos: array}>}
     */
    async filtrarFicheirosParaDIP(aip, utilizadorId, papelUtilizador, opcoes = {}) {
        try {
            const recurso = await Recurso.findById(aip.recursoId);
            
            if (!recurso) {
                throw new Error('Recurso não encontrado');
            }
            
            const manifesto = aip.manifesto || {};
            const ficheirosManifesto = manifesto.files || [];
            const ficheirosSolicitados = normalizarListaFicheiros(opcoes.ficheirosSolicitados);
            const temSelecaoExplicita = ficheirosSolicitados.length > 0;
            const nomesSolicitados = new Set(ficheirosSolicitados);
            
            const ficheirosIncluidos = [];
            const ficheirosExcluidos = [];

            for (const ficheiro of ficheirosManifesto) {
                const base = {
                    name: ficheiro.name,
                    size: ficheiro.size,
                    type: ficheiro.type,
                    required: ficheiro.required,
                    checksum_sha256: ficheiro.checksum_sha256 || 'pendente'
                };

                if (temSelecaoExplicita && !nomesSolicitados.has(ficheiro.name)) {
                    ficheirosExcluidos.push({
                        ...base,
                        motivo_exclusao: 'Nao solicitado no pedido de disseminacao'
                    });
                    continue;
                }

                ficheirosIncluidos.push({
                    ...base,
                    incluido_no_dip: true
                });
            }
            
            return {
                ficheirosIncluidos,
                ficheirosExcluidos,
                politicaAplicada: {
                    visibilidade: recurso.visibilidade,
                    temSelecaoExplicita,
                    ficheirosSolicitados,
                    totalDisponiveis: ficheirosManifesto.length,
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
