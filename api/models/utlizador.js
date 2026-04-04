const mongoose = require('mongoose');

const utilizadorSchema = new mongoose.Schema({
    nome: String,
    email: { type: String, required: true, unique: true }, // único no sistema
    password: { type: String, required: true },
    nivel: { type: String, enum: ['admin', 'produtor', 'consumidor'], default: 'consumidor' }, // controlo de acesso
    filiacao: String, // ex: estudante, docente, departamento
    dataRegisto: { type: Date, default: Date.now },
    dataUltimoAcesso: Date
});

module.exports = mongoose.model('Utilizador', utilizadorSchema);