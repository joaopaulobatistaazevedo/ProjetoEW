const fs = require('fs').promises;
const path = require('path');
const AdmZip = require('adm-zip');
const Recurso = require('../models/recurso');
const AIP = require('../models/aip');
const Noticia = require('../models/noticia');

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
    async processarSIP(manifesto, utilizadorId, caminhoZipTemp, checksumZip, utilizador = {}) {
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
                ficheiros: [],  // Será preenchido durante processamento
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

            // 4. Atualizar recurso com ficheiros 
            const crypto = require('crypto');
            const ficheirosList = [];
            
            if (manifesto.files && manifesto.files.length > 0) {
                // Iterar sobre todos os ficheiros e extrair metadados
                for (let idx = 0; idx < manifesto.files.length; idx++) {
                    const metadadosManifesto = manifesto.files[idx];
                    const caminhoCompleto = path.join(dataDir, metadadosManifesto.name);
                    
                    let tamanhoFicheiro = 0;
                    let checksumFicheiro = null;
                    
                    try {
                        // Obter tamanho do ficheiro escrito
                        const stats = await fs.stat(caminhoCompleto);
                        tamanhoFicheiro = stats.size;
                        
                        // Calcular checksum (SHA256)
                        const conteudo = await fs.readFile(caminhoCompleto);
                        checksumFicheiro = crypto.createHash('sha256').update(conteudo).digest('hex');
                    } catch (err) {
                        console.warn(`Aviso ao calcular checksum para ${metadadosManifesto.name}:`, err.message);
                    }
                    
                    // Adicionar à array de ficheiros
                    ficheirosList.push({
                        nome: metadadosManifesto.name,
                        caminho: path.join('/uploads/recursos', String(recursoGuardado._id), 'data', metadadosManifesto.name),
                        tamanho: tamanhoFicheiro,
                        tipo: metadadosManifesto.type || 'application/octet-stream',
                        checksum: checksumFicheiro || metadadosManifesto.checksum_sha256,
                        dataAdicionado: new Date(),
                        versaoAIP: 1  // Versão do AIP que o adicionou
                    });
                }
                
                // Atualizar recurso com array — sempre primeiro ficheiro como principal
                recursoGuardado.ficheiros = ficheirosList;
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

            try {
                const autorNome = utilizador && (utilizador.nome || utilizador.username)
                    ? (utilizador.nome || utilizador.username)
                    : 'Um utilizador';

                await Noticia.create({
                    titulo: 'Novo recurso adicionado',
                    conteudo: `O produtor ${autorNome} submeteu o recurso "${recursoGuardado.titulo}".`,
                    tipo: 'novo_recurso',
                    link: `/recursos/${recursoGuardado._id}`,
                    autorNome
                });
            } catch (noticiaErr) {
                console.warn('Não foi possível registar notícia de submissão SIP:', noticiaErr.message);
            }

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

    // Criar novo AIP versão quando ficheiro é atualizado via PUT
    async criarNovaVersaoAIP(recursoId, utilizadorId, novoFicheiro, motivoAtualizacao = 'ficheiro_corrigido') {
        try {
            // 1. Obter AIP atual (versão mais alta)
            const aipAtual = await AIP.findOne({ recursoId })
                .sort({ versao: -1 })
                .lean();
            
            if (!aipAtual) {
                throw new Error('Nenhum AIP existente para este recurso');
            }
            
            const novaVersao = (aipAtual.versao || 1) + 1;
            const crypto = require('crypto');
            
            // 2. Calcular checksum do novo ficheiro
            let checksumNovoFicheiro = null;
            let tamanhoNovoFicheiro = 0;
            try {
                const conteudo = await fs.readFile(novoFicheiro);
                checksumNovoFicheiro = crypto.createHash('sha256').update(conteudo).digest('hex');
                tamanhoNovoFicheiro = conteudo.length;
            } catch (err) {
                console.warn('Aviso ao calcular checksum do novo ficheiro:', err.message);
            }
            
            // 3. Criar novo manifesto com ficheiro atualizado
            const novoManifesto = JSON.parse(JSON.stringify(aipAtual.manifesto));
            novoManifesto.ficheirosAtualizados = [{
                nome: path.basename(novoFicheiro),
                caminho: novoFicheiro,
                checksum: checksumNovoFicheiro,
                tamanho: tamanhoNovoFicheiro,
                dataAtualizacao: new Date()
            }];
            
            // 4. Gerar novo SIP ID com versão a partir do SIP original
            let aipBase = aipAtual;
            while (aipBase && aipBase.aipAnterior) {
                const anterior = await AIP.findById(aipBase.aipAnterior).lean();
                if (!anterior) break;
                aipBase = anterior;
            }
            const sipIdBase = String((aipBase && aipBase.sipId) || aipAtual.sipId)
                .replace(/-v\d+$/i, '');
            const novaSipId = `${sipIdBase}-v${novaVersao}`;
            
            // 5. Criar novo AIP (versão incrementada)
            const novoAIP = new AIP({
                sipId: novaSipId,
                recursoId: recursoId,
                versao: novaVersao,
                aipAnterior: aipAtual._id,
                motivoAtualizacao: motivoAtualizacao,
                status: 'ok',
                dataIngestao: new Date(),
                produtor: utilizadorId,
                manifesto: novoManifesto,
                validacoes: {
                    estrutura: { ok: true },
                    metadados: { ok: true },
                    seguranca: { ok: true },
                    consistencia: { ok: true }
                },
                storageLocal: aipAtual.storageLocal,
                relatorio: {
                    dataValidacao: new Date(),
                    erros: [],
                    avisos: [`Actualização de ficheiro via PUT — versão ${novaVersao}`]
                }
            });
            
            await novoAIP.save();
            
            return {
                aipId: novoAIP._id,
                versao: novaVersao,
                sipId: novaSipId,
                aipAnterior: aipAtual._id
            };
        } catch (err) {
            throw new Error(`Erro ao criar nova versão AIP: ${err.message}`);
        }
    }
}

module.exports = SIPProcessor;
