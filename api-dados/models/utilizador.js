const mongoose = require('mongoose');

// Modelo mínimo para permitir populate('Utilizador') no serviço api-dados.
// A autenticação e gestão de passwords continuam no serviço auth.
const utilizadorSchema = new mongoose.Schema({
    username: String,
    nome: String,
    email: String,
    role: String,
    filiacao: String,
    ativo: Boolean,
    dataRegisto: Date,
    dataUltimoAcesso: Date
}, {
    versionKey: false,
    collection: 'utilizadors'
});

module.exports = mongoose.model('Utilizador', utilizadorSchema);
