const File = require('../models/file');
const fs = require('fs').promises;

// 1. Upload
exports.uploadFile = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'Nenhum ficheiro enviado!' });
        }

        const newFile = new File({
            originalName: req.file.originalname,
            storageName: req.file.filename,
            path: req.file.path,
            mimeType: req.file.mimetype,
            size: req.file.size,
            tags: req.body.tags ? req.body.tags.split(',') : [],
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
        return res.download(file.path, file.originalName);
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

        try {
            await fs.unlink(file.path);
        } catch (error) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }
        await file.deleteOne();
        return res.json({ message: 'Ficheiro removido com sucesso.' });
    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
};
