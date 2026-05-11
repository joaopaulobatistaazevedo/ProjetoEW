const AdmZip = require('adm-zip');
const fs = require('fs').promises;
const path = require('path');

/**
 * Serviço para gerar um SIP ZIP a partir de dados de formulário
 * Normaliza metadados e ficheiros no formato esperado pelo processador SIP
 */
class FormToSIPGenerator {
    
    /**
     * Gera SIP ZIP a partir de dados de formulário + ficheiros multipart
     * 
     * @param {object} dados - metadados do formulário
     * @param {array} ficheirosMultipart - array de ficheiros do multer
     * @returns {Promise<string>} caminho do ZIP gerado
     */
    async gerarSIPDoFormulario(dados, ficheirosMultipart) {
        try {
            // 1. Validar entrada
            if (!dados.titulo || !dados.descricao || !dados.tipo) {
                throw new Error('Metadados obrigatórios ausentes: titulo, descricao, tipo');
            }
            
            if (!ficheirosMultipart || ficheirosMultipart.length === 0) {
                throw new Error('Nenhum ficheiro selecionado');
            }

            // 2. Preparar manifesto
            const manifesto = {
                titulo: dados.titulo,
                subtitulo: dados.subtitulo || '',
                descricao: dados.descricao,
                tipo: dados.tipo.toLowerCase(),
                dataCriacao: dados.dataCriacao || new Date().toISOString().split('T')[0],
                visibilidade: dados.visibilidade || 'publico',
                hashtags: this.normalizarHashtags(dados.hashtags),
                files: []  // será preenchido abaixo
            };

            // 3. Criar ZIP com estrutura SIP
            const zip = new AdmZip();
            
            // Adicionar manifest.json na raiz
            zip.addFile(
                'manifest.json',
                Buffer.from(JSON.stringify(manifesto, null, 2), 'utf8')
            );

            // 4. Processar ficheiros e adicionar a data/
            const crypto = require('crypto');
            
            for (const ficheiro of ficheirosMultipart) {
                try {
                    const conteudo = ficheiro.buffer || await fs.readFile(ficheiro.path);
                    
                    // Calcular checksum SHA256
                    const checksum = crypto
                        .createHash('sha256')
                        .update(conteudo)
                        .digest('hex');
                    
                    // Adicionar nome normalizado ao manifesto
                    manifesto.files.push({
                        name: path.basename(ficheiro.originalname),
                        size: conteudo.length,
                        type: ficheiro.mimetype || 'application/octet-stream',
                        checksum_sha256: checksum,
                        required: true  // todos os ficheiros do formulário são requeridos
                    });
                    
                    // Adicionar ficheiro ao ZIP em data/
                    zip.addFile(
                        `data/${path.basename(ficheiro.originalname)}`,
                        conteudo
                    );
                    
                    if (ficheiro.path) {
                        await fs.unlink(ficheiro.path);
                    }
                } catch (err) {
                    console.error(`Erro ao processar ficheiro ${ficheiro.originalname}:`, err.message);
                    throw new Error(`Falha ao processar ${ficheiro.originalname}: ${err.message}`);
                }
            }

            // 5. Atualizar manifesto com checksums
            zip.updateFile(
                zip.getEntry('manifest.json'),
                Buffer.from(JSON.stringify(manifesto, null, 2), 'utf8')
            );

            // 6. Escrever ZIP temporário
            const dir = path.join(__dirname, '..', 'uploads', 'temp');
            await fs.mkdir(dir, { recursive: true });
            
            const nomeZip = `form-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.zip`;
            const caminhoZip = path.join(dir, nomeZip);
            
            await fs.writeFile(caminhoZip, zip.toBuffer());
            
            console.log(`SIP gerado do formulário: ${caminhoZip}`);
            return caminhoZip;
        } catch (err) {
            // Limpar ficheiros temporários em caso de erro
            if (ficheirosMultipart) {
                for (const f of ficheirosMultipart) {
                    try {
                        if (f.path) {
                            await fs.unlink(f.path);
                        }
                    } catch (e) {
                        // ignorar erro de limpeza
                    }
                }
            }
            throw err;
        }
    }

    /**
     * Normaliza hashtags separadas por vírgula
     * @param {string} tags
     * @returns {array}
     */
    normalizarHashtags(tags) {
        if (!tags) return [];
        return tags
            .split(',')
            .map(t => t.trim().toLowerCase().replace(/[^a-z0-9]/g, ''))
            .filter(t => t.length > 0);
    }
}

module.exports = new FormToSIPGenerator();
