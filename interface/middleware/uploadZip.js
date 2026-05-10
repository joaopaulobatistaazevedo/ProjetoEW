const multer = require('multer');

const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 100 * 1024 * 1024
    }
});

module.exports = {
    uploadSipZip: upload.single('ficheiro'),  // Aceita campo 'ficheiro' do formulário (SIP ZIP)
    uploadMultipleFiles: upload  // Para upload múltiplo de ficheiros (formulário assistido)
};
