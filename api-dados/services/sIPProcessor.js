const fs = require('fs').promises;
const path = require('path');
const AdmZip = require('adm-zip');
const Recurso = require('../models/recurso');
const AIP = require('../models/aip');

// Orquestra ingestao: cria Recurso, move ficheiros e cria AIP
class SIPProcessor {
    constructor() {
        this.recursoId = null;
        this.aipId = null;
        this.storageLocal = null;
    }

    // Gerar IDs únicos
    gerarSiPId() {
        const data = new Date();
        const ano = data.getFullYear();
        const mes = String(data.getMonth() + 1).padStart(2, '0');
        const dia = String(data.getDate()).padStart(2, '0');
        const random = Math.floor(Math.random() * 10000).toString().padStart(5, '0');
        return `SIP-${ano}${mes}${dia}-${random}`;
    }

    // Processar SIP: criar Recurso + mover ficheiros + criar AIP
    async processarSIP(manifesto, utilizadorId, caminhoZipTemp, checksumZip) {
        try {
            // 1. Criar Recurso a partir do manifesto
            const novoRecurso = new Recurso({
                titulo: manifesto.titulo,
                subtitulo: manifesto.subtitulo || '',
                descricao: manifesto.descricao || '',
                tipo: manifesto.tipo,
                dataCriacao: manifesto.dataCriacao ? new Date(manifesto.dataCriacao) : new Date(),
                dataRegisto: new Date(),
                visibilidade: manifesto.visibilidade || 'publico',
                autor: utilizadorId,
                hashtags: manifesto.hashtags || [],
                ficheiro: '', // Será preenchido com path de storage
                ratings: [],
                mediaEstrelas: 0
            });

            const recursoGuardado = await novoRecurso.save();
            this.recursoId = recursoGuardado._id;

            // 2. Criar diretório de storage para este recurso
            const baseStorage = path.join(__dirname, '..', 'uploads', 'recursos');
            this.storageLocal = path.join(baseStorage, String(recursoGuardado._id));
            const dataDir = path.join(this.storageLocal, 'data');
            const sourceDir = path.join(this.storageLocal, 'source');

            await fs.mkdir(dataDir, { recursive: true });

            // 3. Descompactar e mover ficheiros
            const zip = new AdmZip(caminhoZipTemp);
            const entries = zip.getEntries();

            // Normalizar caso o ZIP venha com uma pasta raiz única
            const ficheirosNaoDiretorio = entries
                .filter(entry => !entry.isDirectory)
                .map(entry => entry.entryName);

            let pastaRaiz = '';
            if (ficheirosNaoDiretorio.length > 0) {
                const primeira = ficheirosNaoDiretorio[0].split('/')[0];
                if (ficheirosNaoDiretorio.every(nome => nome.startsWith(primeira + '/'))) {
                    pastaRaiz = primeira + '/';
                }
            }

            for (const entry of entries) {
                if (entry.isDirectory) continue;

                let nomeNormalizado = entry.entryName;
                if (pastaRaiz && nomeNormalizado.startsWith(pastaRaiz)) {
                    nomeNormalizado = nomeNormalizado.substring(pastaRaiz.length);
                }

                // Apenas ficheiros em data/
                if (nomeNormalizado.startsWith('data/')) {
                    const nomeLocal = nomeNormalizado.substring(5); // Remove 'data/'
                    const caminhoDestino = path.join(dataDir, nomeLocal);

                    // Garantir que o diretório de destino existe
                    const dirDestino = path.dirname(caminhoDestino);
                    await fs.mkdir(dirDestino, { recursive: true });

                    // Escrever ficheiro
                    await fs.writeFile(caminhoDestino, entry.getData());
                }
            }

            // 3b. Guardar cópia do SIP original para permitir reconstrução futura do DIP
            await fs.mkdir(sourceDir, { recursive: true });
            await fs.copyFile(caminhoZipTemp, path.join(sourceDir, 'sip-original.zip'));

            // 4. Atualizar recurso com path do ficheiro principal (primeiro em data/)
            if (manifesto.files && manifesto.files.length > 0) {
                const primeiroFicheiro = manifesto.files[0].name;
                recursoGuardado.ficheiro = path.join('/uploads/recursos', String(recursoGuardado._id), 'data', primeiroFicheiro);
                await recursoGuardado.save();
            }

            // 5. Criar AIP para rastreabilidade
            this.aipId = this.gerarSiPId();
            const novoAIP = new AIP({
                sipId: this.aipId,
                recursoId: recursoGuardado._id,
                status: 'ok',
                dataIngestao: new Date(),
                produtor: utilizadorId,
                manifesto: manifesto,
                validacoes: {
                    estrutura: { ok: true },
                    metadados: { ok: true },
                    seguranca: { ok: true },
                    consistencia: { ok: true }
                },
                storageLocal: this.storageLocal,
                relatorio: {
                    dataValidacao: new Date(),
                    erros: [],
                    avisos: []
                },
                checksumSIP: checksumZip,
                downloadCount: 0
            });

            await novoAIP.save();

            // 6. Limpar ficheiro temporário
            try {
                await fs.unlink(caminhoZipTemp);
            } catch (err) {
                console.error('Erro ao limpar ficheiro temporário:', err.message);
            }

            return {
                sucesso: true,
                recursoId: String(recursoGuardado._id),
                aipId: this.aipId,
                storageLocal: this.storageLocal,
                mensagem: 'SIP ingerido com sucesso'
            };
        } catch (err) {
            // Limpar em caso de erro
            if (this.recursoId) {
                try {
                    await Recurso.findByIdAndDelete(this.recursoId);
                    if (this.aipId) {
                        await AIP.findOneAndDelete({ sipId: this.aipId });
                    }
                    // Limpar diretório de storage
                    if (this.storageLocal) {
                        await fs.rm(this.storageLocal, { recursive: true, force: true });
                    }
                } catch (cleanErr) {
                    console.error('Erro ao limpar após falha:', cleanErr.message);
                }
            }

            try {
                await fs.unlink(caminhoZipTemp);
            } catch (err2) {
                console.error('Erro ao limpar ficheiro temporário:', err2.message);
            }

            throw new Error(`Erro ao processar SIP: ${err.message}`);
        }
    }

    // Registar erro no AIP (para falhas tardia)
    async registarErroAIP(manifesto, utilizadorId, checksumZip, erros, avisos) {
        const aipId = this.gerarSiPId();
        
        const novoAIP = new AIP({
            sipId: aipId,
            status: 'erro',
            dataIngestao: new Date(),
            produtor: utilizadorId,
            manifesto: manifesto,
            validacoes: {
                estrutura: { ok: false },
                metadados: { ok: false },
                seguranca: { ok: false },
                consistencia: { ok: false }
            },
            relatorio: {
                dataValidacao: new Date(),
                erros: erros,
                avisos: avisos
            },
            checksumSIP: checksumZip,
            downloadCount: 0
        });

        await novoAIP.save();
        return aipId;
    }
}

module.exports = SIPProcessor;
