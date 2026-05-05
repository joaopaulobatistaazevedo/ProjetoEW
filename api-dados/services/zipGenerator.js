// IO, paths, ZIP e hashing
const fs = require('fs').promises;
const path = require('path');
const JSZip = require('jszip');
const crypto = require('crypto');

/**
 * Serviço: Geração de ZIP para SIP/DIP (usando JSZip)
 * Cria ZIP no formato BagIt com validação
 * 
 * Padrão: Semelhante a Semana13-aula/cria_zip.js
 */
// Servico central para montar SIP/DIP em ZIP (BagIt)
const ZipGenerator = {

    /**
     * Adiciona pasta recursivamente ao ZIP (padrão Semana13-aula)
     * @param {JSZip} zipper - Instância de JSZip
     * @param {string} caminhoLocal - Caminho local da pasta
     * @param {string} caminhoZip - Caminho dentro do ZIP
     */
    async adicionarPastaRecursiva(zipper, caminhoLocal, caminhoZip = '') {
        try {
            const itens = await fs.readdir(caminhoLocal);

            for (const item of itens) {
                const caminhoCompleto = path.join(caminhoLocal, item);
                const caminhoZipItem = path.join(caminhoZip, item);
                const stats = await fs.stat(caminhoCompleto);

                if (stats.isDirectory()) {
                    // Pasta: cria entrada e desce recursivamente
                    zipper.folder(caminhoZipItem);
                    await this.adicionarPastaRecursiva(zipper, caminhoCompleto, caminhoZipItem);
                } else {
                    // Ficheiro: ler e adicionar ao ZIP
                    const conteudo = await fs.readFile(caminhoCompleto);
                    zipper.file(caminhoZipItem, conteudo);
                }
            }
        } catch (err) {
            console.error(`Erro ao adicionar pasta ao ZIP (${caminhoLocal}):`, err.message);
            throw err;
        }
    },

    /**
     * Calcula checksum SHA256 de um ficheiro
     */
    async calcularChecksum(caminhoFicheiro) {
        try {
            const conteudo = await fs.readFile(caminhoFicheiro);
            // SHA256 em hexadecimal
            return crypto.createHash('sha256').update(conteudo).digest('hex');
        } catch (err) {
            console.warn(`Aviso: Não foi possível calcular checksum para ${caminhoFicheiro}`);
            return 'pendente';
        }
    },

    /**
     * Gera conteúdo de checksums.txt (formato BagIt)
     */
    gerarChecksumsContent(ficheiros) {
        // Apenas ficheiros com checksum valido
        return ficheiros
            .filter(f => f.checksum_sha256 && f.checksum_sha256 !== 'pendente')
            .map(f => `${f.checksum_sha256}  data/${f.name}`)
            .join('\n');
    },

    /**
     * Gera log de disseminação (audit trail)
     */
    gerarLogDisseminacao(dip, recursoId, utilizadorId) {
        const agora = new Date().toISOString();
        // Log legivel para auditoria
        return `=== LOG DE DISSEMINAÇÃO ===
Data: ${agora}
AIP ID: ${dip.aipId}
Recurso ID: ${recursoId}
Utilizador: ${utilizadorId}
Visibilidade: ${dip.metadados_enriquecidos.visibilidade}
Ficheiros incluídos: ${dip.ficheirosIncluidos.length}
Ficheiros excluídos: ${dip.ficheirosExcluidos.length}

--- FICHEIROS INCLUÍDOS ---
${dip.ficheirosIncluidos.map(f => `✓ ${f.name} (${(f.size / 1024).toFixed(2)}KB) SHA256: ${f.checksum_sha256 || 'pendente'}`).join('\n')}

--- FICHEIROS EXCLUÍDOS (por política de visibilidade) ---
${dip.ficheirosExcluidos.length > 0 ? dip.ficheirosExcluidos.map(f => `✗ ${f.name} - ${f.motivo_exclusao}`).join('\n') : 'Nenhum'}

--- RESULTADO ---
Tamanho total: ${(dip.ficheirosIncluidos.reduce((sum, f) => sum + f.size, 0) / 1024).toFixed(2)}KB
Status: OK

=== FIM DO LOG ===`;
    },

    /**
     * Gera um SIP-ZIP ou DIP-ZIP (BagIt) 
     * @param {object} sip - Objeto com metadados e ficheiros
     * @param {string} tipo - 'SIP' ou 'DIP'
     * @param {object} opcoes - Opções (utilizadorId, aipId, recursoId, etc)
     * @returns {Promise<Buffer>} - Conteúdo do ZIP como buffer
     */
    async gerarZip(sip, tipo = 'SIP', opcoes = {}) {
        try {
            const zipper = new JSZip();

            // Manifesto com metadados e lista de ficheiros
            const manifesto = {
                tipo_pacote: tipo,
                versao: tipo === 'DIP' ? '1.0' : '1.0',
                timestamp: new Date().toISOString(),
                ...(tipo === 'DIP' && {
                    aipId: opcoes.aipId,
                    recursoId: opcoes.recursoId,
                    dataExportacao: new Date().toISOString(),
                    exportadoPor: opcoes.utilizadorId
                }),
                metadados_originais: sip.metadados || {},
                metadados_enriquecidos: typeof sip.metadados_enriquecidos === 'object' 
                    ? sip.metadados_enriquecidos 
                    : {},
                ficheiros: sip.ficheirosIncluidos?.map(f => ({
                    name: f.name,
                    size: f.size,
                    type: f.type || 'application/octet-stream',
                    required: f.required !== undefined ? f.required : false,
                    checksum_sha256: f.checksum_sha256 || 'pendente',
                    incluido: true
                })) || [],
                ficheiros_excluidos: sip.ficheirosExcluidos?.length || 0
            };

            console.log(`📦 Gerando ${tipo}-ZIP com ${manifesto.ficheiros.length} ficheiros...`);

            // 1) manifest.json
            zipper.file('manifest.json', JSON.stringify(manifesto, null, 2));

            // 2) BagIt: metadata basica do pacote
            zipper.file('bagit.txt', 'BagIt-Version: 1.0\nTag-File-Character-Encoding: UTF-8\n');

            // 3) Conteudos em /data/
            if (sip.ficheirosIncluidos && sip.ficheirosIncluidos.length > 0) {
                for (const ficheiro of sip.ficheirosIncluidos) {
                    if (ficheiro.caminhoLocal) {
                        try {
                            const conteudo = await fs.readFile(ficheiro.caminhoLocal);
                            zipper.file(`data/${ficheiro.name}`, conteudo);
                        } catch (err) {
                            console.warn(`⚠ Ficheiro não encontrado: ${ficheiro.name}`);
                        }
                    }
                }
            }

            // 4) Checksums BagIt
            zipper.file('checksums.txt', this.gerarChecksumsContent(sip.ficheirosIncluidos || []));

            // 5) Log apenas para DIP
            if (tipo === 'DIP') {
                zipper.file('disseminacao.log', 
                    this.gerarLogDisseminacao(sip, opcoes.recursoId, opcoes.utilizadorId));
            }

            // 6) Compactar e devolver buffer
            console.log(`⚡ Comprimindo ${tipo}...`);
            const buffer = await zipper.generateAsync({
                type: 'nodebuffer',
                compression: 'DEFLATE',
                compressionOptions: { level: 9 }
            });

            console.log(`✅ ${tipo}-ZIP gerado com sucesso (${(buffer.length / 1024).toFixed(2)}KB)`);
            return buffer;

        } catch (err) {
            console.error(`✗ Erro ao gerar ${tipo}-ZIP:`, err.message);
            throw err;
        }
    },

    /**
     * Conveniência: Gera DIP-ZIP
     */
    async gerarDIPZip(dip, aipId, recursoId, utilizadorId, opcoes = {}) {
        // Wrapper para DIP
        return this.gerarZip(dip, 'DIP', {
            aipId,
            recursoId,
            utilizadorId,
            ...opcoes
        });
    },

    /**
     * Conveniência: Gera SIP-ZIP
     */
    async gerarSIPZip(sip, opcoes = {}) {
        // Wrapper para SIP
        return this.gerarZip(sip, 'SIP', opcoes);
    }
};

module.exports = ZipGenerator;
