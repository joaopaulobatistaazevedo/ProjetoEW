const express = require('express');
const router = express.Router();
const fileController = require('../controllers/file');
const upload = require('../config/multer');

// POST
router.post('/upload', upload.single('file'), fileController.uploadFile);
// GET: Listar e pesquisar ficheiros
router.get('/', upload.single('file'), fileController.getFiles);
// GET: Download
router.get('/download/:id', fileController.downloadFile);
// DELETE
router.delete('/:id', fileController.deleteFile);

module.exports = router;
