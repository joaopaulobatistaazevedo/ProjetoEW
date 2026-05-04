const AdmZip = require('adm-zip');
const fs = require('fs').promises;

/**
 * Serviço: Geração de ZIP para DIP (usando adm-zip)
 * Cria ZIP no formato BagIt com validação
 */
class ZipGenerator {
    
    /**
     * Helper: Gera checksums.txt (formato BagIt)
     */
    static gerarChecksumsContent(ficheiros) {
        return ficheiros
            .filter(f => f.checksum_sha256 && f.checksum_sha256 !== 'pendente')
            .map(f => `${f.checksum_sha256}  data/${f.name}`)
            .join('\n');
    }
    
    /**
     * Helper: Gera log de disseminação simplificado
     */
    static gerarLogDisseminacao(dip, recursoId, utilizadorId) {
        const agora = new Date().toISOString();
        return `=== LOG DE DISSEMINAÇÃO ===
Data: ${agora}
AIP ID: ${dip.aipId}
Recurso ID: ${recursoId}
Utilizador: ${utilizadorId}
Visibilidade: ${dip.metadados_enriquecidos.visibilidade}
Ficheiros incluídos: ${dip.ficheirosIncluidos.length}
Ficheiros excluídos: ${dip.ficheirosExcluidos.length}

--- FICHEIROS ---
${dip.ficheirosIncluidos.map(f => `✓ ${f.name} (${(f.size / 1024).toFixed(2)}KB)`).join('\n')}
${dip.ficheirosExcluidos.map(f => `✗ ${f.name} - ${f.motivo_exclusao}`).join('\n')}

=== FIM DO LOG ===`;
    }
    
    /**
     * Gera um DIP-ZIP (BagIt) a partir de um AIP
     */
    async gerarDIPZip(dip, aipId, recursoId, utilizadorId, opcoes = {}) {
        try {
            const zip = new AdmZip();
            
            // Manifesto enriquecido
            const manifesto = {
                tipo_pacote: 'DIP',
                versao_dip: '1.0',
                aipId, recursoId,
                metadados_originais: dip.metadados_originais || {},
                metadados_enriquecidos: {
                    dataIngestao: dip.dataIngestao || new Date().toISOString(),
                    dataExportacao: new Date().toISOString(),
                    exportadoPor: utilizadorId,
                    versionAIP: dip.versionAIP || 1,
                    visibilidade: dip.metadados_enriquecidos?.visibilidade || 'publico'
                },
                ficheiros: dip.ficheirosIncluidos.map(f => ({
                    name: f.name,
                    size: f.size,
                    type: f.type,
                    required: f.required !== undefined ? f.required : true,
                    checksum_sha256: f.checksum_sha256 || 'pendente',
                    incluido_no_dip: true
                })),
                politica_visibilidade_aplicada: {
                    ficheiros_incluidos: dip.ficheirosIncluidos.length,
                    ficheiros_excluidos: dip.ficheirosExcluidos.length
                }
            };
            
            // Adicionar ficheiros ao ZIP
            zip.addFile('manifest.json', Buffer.from(JSON.stringify(manifesto, null, 2)));
            zip.addFile('bagit.txt', Buffer.from('BagIt-Version: 1.0\nTag-File-Character-Encoding: UTF-8'));
            
            // Ficheiros no /data/
            for (const ficheiro of dip.ficheirosIncluidos) {
                if (ficheiro.caminhoLocal) {
                    try {
                        const conteudo = await fs.readFile(ficheiro.caminhoLocal);
                        zip.addFile(`data/${ficheiro.name}`, conteudo);
                    } catch (err) {
                        console.warn(`Aviso: Ficheiro não lido: ${ficheiro.name}`);
                    }
                }
            }
            
            // Checksums e log
            zip.addFile('checksums.txt', 
                Buffer.from(ZipGenerator.gerarChecksumsContent(dip.ficheirosIncluidos)));
            zip.addFile('disseminacao.log',
                Buffer.from(ZipGenerator.gerarLogDisseminacao(dip, recursoId, utilizadorId)));
            
            return zip.toBuffer();
            
        } catch (err) {
            console.error('Erro ao gerar DIP-ZIP:', err);
            throw err;
        }
    }
}

module.exports = new ZipGenerator();
