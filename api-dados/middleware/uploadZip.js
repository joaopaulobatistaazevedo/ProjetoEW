const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Middleware especifico para upload de ZIPs (SIP)
const storageZip = multer.diskStorage({
    destination: function (req, file, cb) {
        const dir = path.join(__dirname, '..', 'uploads', 'temp');
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        cb(null, dir);
    },
    filename: function (req, file, cb) {
        // Prefix with timestamp/random to avoid collisions
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + file.originalname);
    }
});

const fileFilterZip = (req, file, cb) => {
    // Aceita apenas ZIP por mime ou extensao
    const allowedMimes = ['application/zip', 'application/x-zip-compressed'];
    const ext = path.extname(file.originalname).toLowerCase();
    
    if (allowedMimes.includes(file.mimetype) || ext === '.zip') {
        cb(null, true);
    } else {
        cb(new Error('Apenas ficheiros ZIP são permitidos'), false);
    }
};

const uploadZip = multer({
    storage: storageZip,
    fileFilter: fileFilterZip,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB limite para ZIP
    }
});

module.exports = uploadZip;
