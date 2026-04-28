const File = require('../models/file');
const fs = require('fs').promises;
const path = require('path');

const uploadsDir = path.join(__dirname, '..', 'uploads');

const resolveUploadPath = (filePath) => {
    const resolvedPath = path.resolve(filePath);
    const normalizedUploadsDir = path.resolve(uploadsDir) + path.sep;
    if (!resolvedPath.startsWith(normalizedUploadsDir)) {
        return null;
    }
    return resolvedPath;
};

// 1. Upload
exports.uploadFile = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Nenhum ficheiro enviado!' });
        }

        const tags = typeof req.body.tags === 'string'
            ? req.body.tags.split(',').map(tag => tag.trim().toLowerCase()).filter(Boolean)
            : [];

        const newFile = new File({
            originalName: req.file.originalname,
            storageName: req.file.filename,
            path: req.file.path,
            mimeType: req.file.mimetype,
            size: req.file.size,
            tags,
            category: req.body.category
        });
        await newFile.save();
        return res.status(201).json(newFile);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

// 2. Pesquisa / Listagem
exports.getFiles = async (req, res) => {
    try {
        const search = typeof req.query.search === 'string' ? req.query.search : undefined;
        const category = typeof req.query.category === 'string' ? req.query.category : undefined;
        const query = {};
        if (search) {
            query.$text = { $search: search };
        }
        if (category) {
            query.category = category;
        }
        const files = await File.find(query).sort({ createdAt: -1 });
        return res.json(files);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

// 3. Download
exports.downloadFile = async (req, res) => {
    try {
        const file = await File.findById(req.params.id);
        if (!file) {
            return res.status(404).json({ message: 'Ficheiro não encontrado.' });
        }
        const resolvedPath = resolveUploadPath(file.path);
        if (!resolvedPath) {
            return res.status(400).json({ message: 'Caminho de ficheiro inválido.' });
        }
        return res.download(resolvedPath, file.originalName);
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};

// 4. Remoção
exports.deleteFile = async (req, res) => {
    try {
        const file = await File.findById(req.params.id);
        if (!file) {
            return res.status(404).json({ message: 'Ficheiro não encontrado.' });
        }

        const resolvedPath = resolveUploadPath(file.path);
        if (!resolvedPath) {
            return res.status(400).json({ message: 'Caminho de ficheiro inválido.' });
        }
        try {
            await fs.unlink(resolvedPath);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                return res.status(500).json({ error: error.message });
            }
        }
        await file.deleteOne();
        return res.json({ message: 'Ficheiro removido com sucesso.' });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
