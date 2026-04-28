const multer = require('multer');
const path = require('path');
const crypto = require('crypto');

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const hash = crypto.randomBytes(6).toString('hex');
        const ext = path.extname(file.originalname);
        cb(null, `${Date.now()}-${hash}${ext}`);
    }
});

// Filtro opcional (ex: apenas PDFs e Imagens)
const fileFilter = (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Tipo de ficheiro não suportado'), false);
    }
};

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }
});

module.exports = upload;
