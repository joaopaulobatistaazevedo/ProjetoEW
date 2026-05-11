const multer = require('multer');
const path = require('path');
const fs = require('fs');

// ============================================
// UPLOAD GENÉRICO - Recursos (ficheiros variados)
// ============================================
const storageRecursos = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = path.join(__dirname, '..', 'uploads');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const uploadRecursos = multer({ storage: storageRecursos });

// ============================================
// UPLOAD SIP - Ficheiros ZIP (ingestão)
// ============================================
const storageSip = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = path.join(__dirname, '..', 'uploads', 'temp');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const fileFilterSip = (req, file, cb) => {
    const allowedMimes = ['application/zip', 'application/x-zip-compressed'];
    const ext = path.extname(file.originalname).toLowerCase();

    if (allowedMimes.includes(file.mimetype) || ext === '.zip') {
        cb(null, true);
    } else {
        cb(new Error('Apenas ficheiros ZIP são permitidos'), false);
    }
};

const uploadSip = multer({
    storage: storageSip,
    fileFilter: fileFilterSip,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB
    }
});

// ============================================
// UPLOAD MÚLTIPLO - Para formulários com vários ficheiros
// ============================================
const storageMultiplo = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = path.join(__dirname, '..', 'uploads', 'temp');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const uploadMultiplo = multer({
    storage: storageMultiplo
});

module.exports = {
    // Genérico para PUT/POST de recursos
    uploadRecursos,
    
    // SIP ZIP para ingestão
    uploadSipZip: uploadSip,
    
    // Múltiplos ficheiros para formulários
    uploadMultipleFiles: uploadMultiplo
};
