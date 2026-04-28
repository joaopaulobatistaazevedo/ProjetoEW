const express = require('express');
const router = express.Router();
const fileController = require('../controllers/file');
const upload = require('../config/multer');
const rateLimit = require('express-rate-limit');

const filesLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false
});

router.use(filesLimiter);

// POST
router.post('/upload', upload.single('file'), fileController.uploadFile);
// GET: Listar e pesquisar ficheiros
router.get('/', fileController.getFiles);
// GET: Download
router.get('/download/:id', fileController.downloadFile);
// DELETE
router.delete('/:id', fileController.deleteFile);

module.exports = router;
