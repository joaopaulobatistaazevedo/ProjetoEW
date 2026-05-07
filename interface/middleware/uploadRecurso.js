const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Disk storage for temporary resource files (in-memory before sending to API)
const storage = multer.memoryStorage();

const upload = multer({
    storage: storage
});

module.exports = {
    uploadRecursoSingle: upload.single('ficheiro')
};
