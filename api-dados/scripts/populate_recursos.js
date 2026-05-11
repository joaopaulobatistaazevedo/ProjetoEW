#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const JSZip = require('jszip');
const mongoose = require('mongoose');

const Recurso = require('../models/recurso');
const AIP = require('../models/aip');
const Exportacao = require('../models/exportacao');
const Utilizador = require('../models/utilizador');
const { ensureTiposRecursoBase, slugifyTipo } = require('../services/tiposRecursoService');

const ROOT_DIR = path.resolve(__dirname, '..', '..', 'docs', 'recursos');
const STORAGE_DIR = path.resolve(__dirname, '..', 'uploads', 'recursos');
const DEFAULT_MONGO_URL = process.env.MONGO_URL || 'mongodb://127.0.0.1:27017/recursos_educativos';
const SEED_USERNAME = 'seed-recursos';
const SEED_TAG = 'seed-recursos';

const TIPOS_POR_PASTA = {
    'slides-SSI': 'slides',
    'sprites-LI1': 'aplicacao',
    'datasets-ADI': 'outro',
    'exemplos-PL': 'outro'
};

function parseArgs(argv) {
    const options = {
        mongoUrl: DEFAULT_MONGO_URL,
        rootDir: ROOT_DIR,
        reset: true
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];

        if (arg === '--mongo-url' && argv[i + 1]) {
            options.mongoUrl = argv[++i];
            continue;
        }

        if (arg === '--root' && argv[i + 1]) {
            options.rootDir = path.resolve(argv[++i]);
            continue;
        }

        if (arg === '--no-reset') {
            options.reset = false;
            continue;
        }

        if (arg === '--reset') {
            options.reset = true;
        }
    }

    return options;
}

function slugifyTexto(valor) {
    return String(valor || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function humanizeFolderName(folderName) {
    return String(folderName || '')
        .replace(/[-_]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/\b\w/g, letter => letter.toUpperCase());
}

function inferTipo(folderName) {
    return TIPOS_POR_PASTA[folderName] || 'outro';
}

function inferMimeType(filePath) {
    const ext = path.extname(filePath).toLowerCase();

    const map = {
        '.txt': 'text/plain',
        '.md': 'text/markdown',
        '.csv': 'text/csv',
        '.json': 'application/json',
        '.xml': 'application/xml',
        '.html': 'text/html',
        '.htm': 'text/html',
        '.js': 'application/javascript',
        '.py': 'text/x-python',
        '.pdf': 'application/pdf',
        '.png': 'image/png',
        '.bmp': 'image/bmp',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp'
    };

    return map[ext] || 'application/octet-stream';
}

async function checksumFile(filePath) {
    const buffer = await fs.readFile(filePath);
    return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function listTopLevelFolders(rootDir) {
    const entries = await fs.readdir(rootDir, { withFileTypes: true });
    return entries
        .filter(entry => entry.isDirectory())
        .map(entry => entry.name)
        .sort((a, b) => a.localeCompare(b));
}

async function collectFiles(baseDir, currentDir = baseDir) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true });
    const files = [];

    for (const entry of entries) {
        const absolutePath = path.join(currentDir, entry.name);
        const relativePath = path.relative(baseDir, absolutePath).replace(/\\/g, '/');

        if (entry.isDirectory()) {
            const nestedFiles = await collectFiles(baseDir, absolutePath);
            files.push(...nestedFiles);
            continue;
        }

        const stats = await fs.stat(absolutePath);
        files.push({
            nome: relativePath,
            caminhoFisico: absolutePath,
            tamanho: stats.size,
            tipo: inferMimeType(absolutePath),
            checksum: await checksumFile(absolutePath),
            dataAdicionado: new Date(stats.mtime),
            versaoAIP: 1
        });
    }

    return files;
}

async function ensureSeedUser() {
    const existente = await Utilizador.findOne({ username: SEED_USERNAME });
    if (existente) {
        return existente;
    }

    return Utilizador.create({
        username: SEED_USERNAME,
        nome: 'Seed Recursos',
        email: 'seed.recursos@local',
        role: 'admin',
        filiacao: 'ProjetoEW',
        ativo: true,
        dataRegisto: new Date(),
        dataUltimoAcesso: null
    });
}

async function removeStoredFiles(storageLocal) {
    if (!storageLocal) return;
    await fs.rm(storageLocal, { recursive: true, force: true });
}

async function cleanupSeedData(seedAuthorId) {
    const seedResources = await Recurso.find({ autor: seedAuthorId }).lean();

    for (const recurso of seedResources) {
        await AIP.deleteMany({ recursoId: recurso._id });
        await Exportacao.deleteMany({ recursoId: recurso._id });
        await removeStoredFiles(path.join(STORAGE_DIR, String(recurso._id)));
    }

    if (seedResources.length > 0) {
        await Recurso.deleteMany({ autor: seedAuthorId });
    }
}

async function gerarManifesto(folderName, tipo, files, sourceStats) {
    return {
        titulo: humanizeFolderName(folderName),
        subtitulo: `Populacao automatica de ${folderName}`,
        descricao: `Recurso importado a partir da pasta docs/recursos/${folderName}.`,
        tipo,
        visibilidade: 'publico',
        dataCriacao: sourceStats.mtime.toISOString(),
        hashtags: [SEED_TAG, slugifyTexto(folderName)],
        files: files.map(file => ({
            name: file.nome,
            size: file.tamanho,
            type: file.tipo,
            checksum_sha256: file.checksum,
            required: false
        })),
        checksums: files.map(file => ({
            path: `data/${file.nome}`,
            sha256: file.checksum
        }))
    };
}

async function escreverFicheirosNoStorage(storageLocal, files) {
    const dataDir = path.join(storageLocal, 'data');
    await fs.mkdir(dataDir, { recursive: true });

    for (const file of files) {
        const destino = path.join(dataDir, file.nome);
        await fs.mkdir(path.dirname(destino), { recursive: true });
        await fs.copyFile(file.caminhoFisico, destino);
    }
}

async function criarZipOrigem(storageLocal, manifesto, files) {
    const sourceDir = path.join(storageLocal, 'source');
    await fs.mkdir(sourceDir, { recursive: true });

    const zip = new JSZip();
    zip.file('manifest.json', JSON.stringify(manifesto, null, 2));

    for (const file of files) {
        const buffer = await fs.readFile(file.caminhoFisico);
        zip.file(`data/${file.nome}`, buffer);
    }

    const bufferZip = await zip.generateAsync({
        type: 'nodebuffer',
        compression: 'DEFLATE',
        compressionOptions: { level: 9 }
    });

    await fs.writeFile(path.join(sourceDir, 'sip-original.zip'), bufferZip);
}

async function criarRecursoDaPasta(folderName, seedAuthor) {
    const folderPath = path.join(ROOT_DIR, folderName);
    const folderStats = await fs.stat(folderPath);
    const tipo = inferTipo(folderName);
    const files = await collectFiles(folderPath);

    if (files.length === 0) {
        console.log(`Ignorado: ${folderName} nao tem ficheiros.`);
        return null;
    }

    const recurso = await Recurso.create({
        titulo: humanizeFolderName(folderName),
        subtitulo: `Recursos de demonstracao de ${folderName}`,
        descricao: `Conteudos importados automaticamente da pasta docs/recursos/${folderName}.`,
        tipo,
        dataCriacao: folderStats.mtime,
        dataRegisto: new Date(),
        visibilidade: 'publico',
        autor: seedAuthor._id,
        hashtags: [SEED_TAG, slugifyTexto(folderName), 'docs-recursos'],
        ficheiros: [],
        ratings: [],
        mediaEstrelas: 0
    });

    const storageLocal = path.join(STORAGE_DIR, String(recurso._id));
    await escreverFicheirosNoStorage(storageLocal, files);

    const manifesto = await gerarManifesto(folderName, tipo, files, folderStats);
    await criarZipOrigem(storageLocal, manifesto, files);

    const ficheirosRecurso = files.map(file => ({
        nome: file.nome,
        caminho: path.posix.join('/uploads/recursos', String(recurso._id), 'data', file.nome),
        tamanho: file.tamanho,
        tipo: file.tipo,
        checksum: file.checksum,
        dataAdicionado: file.dataAdicionado,
        versaoAIP: 1
    }));

    recurso.ficheiros = ficheirosRecurso;
    await recurso.save();

    const sipId = `SEED-${slugifyTexto(folderName).toUpperCase() || 'RECURSO'}-V1`;
    await AIP.create({
        sipId,
        recursoId: recurso._id,
        versao: 1,
        motivoAtualizacao: 'ingestao_inicial',
        status: 'ok',
        dataIngestao: new Date(),
        produtor: seedAuthor._id,
        manifesto,
        validacoes: {
            estrutura: { ok: true, detalhes: 'Seed automatico' },
            metadados: { ok: true, detalhes: 'Seed automatico' },
            seguranca: { ok: true, detalhes: 'Seed automatico' },
            consistencia: { ok: true, detalhes: 'Seed automatico' }
        },
        storageLocal,
        relatorio: {
            dataValidacao: new Date(),
            erros: [],
            avisos: []
        },
        checksumSIP: await checksumFile(path.join(storageLocal, 'source', 'sip-original.zip')),
        downloadCount: 0
    });

    return {
        titulo: recurso.titulo,
        tipo: recurso.tipo,
        ficheiros: files.length,
        recursoId: String(recurso._id)
    };
}

async function main() {
    const options = parseArgs(process.argv.slice(2));

    if (!options.rootDir) {
        throw new Error('Root directory nao definida.');
    }

    const rootStats = await fs.stat(options.rootDir).catch(() => null);
    if (!rootStats || !rootStats.isDirectory()) {
        throw new Error(`Diretorio de recursos nao encontrado: ${options.rootDir}`);
    }

    await mongoose.connect(options.mongoUrl);
    await ensureTiposRecursoBase();
    await fs.mkdir(STORAGE_DIR, { recursive: true });

    const seedUser = await ensureSeedUser();

    if (options.reset) {
        await cleanupSeedData(seedUser._id);
    }

    const folders = await listTopLevelFolders(options.rootDir);
    if (folders.length === 0) {
        console.log('Nenhuma pasta encontrada para populacao.');
        return;
    }

    const resultados = [];

    for (const folderName of folders) {
        const resultado = await criarRecursoDaPasta(folderName, seedUser);
        if (resultado) {
            resultados.push(resultado);
            console.log(`Criado: ${resultado.titulo} (${resultado.ficheiros} ficheiros)`);
        }
    }

    console.log(`Populacao concluida com ${resultados.length} recursos.`);
}

async function shutdown(code = 0) {
    try {
        await mongoose.disconnect();
    } catch (err) {
        // ignore disconnect errors
    }
    process.exit(code);
}

process.on('SIGINT', () => shutdown(130));
process.on('SIGTERM', () => shutdown(143));

main()
    .then(() => shutdown(0))
    .catch(async err => {
        console.error('Erro na populacao:', err.message);
        try {
            await mongoose.disconnect();
        } catch (disconnectErr) {
            // ignore disconnect errors
        }
        process.exit(1);
    });
