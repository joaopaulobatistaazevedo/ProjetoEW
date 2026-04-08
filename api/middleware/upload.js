// const multer = require('multer');
// const path = require('path');
// const { v4: uuidv4 } = require('uuid');

// const storage = multer.diskStorage({
//     destination: (req, file, cb) => {
//         cb(null, './uploads/');
//     },
//     filename: (req, file, cb) => {
//         const ext = path.extname(file.originalname);
//         cb(null, `${uuidv4()}${ext}`); // nome único para evitar colisões
//     }
// });

// const fileFilter = (req, file, cb) => {
//     const tiposPermitidos = ['.pdf', '.zip', '.docx', '.pptx', '.txt', '.md'];
//     const ext = path.extname(file.originalname).toLowerCase();
//     if (tiposPermitidos.includes(ext)) {
//         cb(null, true);
//     } else {
//         cb(new Error(`Tipo de ficheiro não permitido: ${ext}`), false);
//     }
// };

// const upload = multer({
//     storage,
//     fileFilter,
//     limits: { fileSize: 50 * 1024 * 1024 } // 50MB
// });

// module.exports = upload;