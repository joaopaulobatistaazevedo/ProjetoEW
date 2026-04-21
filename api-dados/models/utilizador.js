const mongoose = require('mongoose');

const utilizadorSchema = new mongoose.Schema({
    username:         { type: String, required: true, unique: true },
    nome:             { type: String, required: true },
    email:            { type: String, required: true, unique: true },
    password:         { type: String, required: true },
    role:             { type: String, enum: ['admin', 'produtor', 'consumidor'], default: 'consumidor' },
    filiacao:         String,
    apiKey:           { type: String, unique: true, sparse: true },
    dataRegisto:      { type: Date, default: Date.now },
    dataUltimoAcesso: Date
});

module.exports = mongoose.model('Utilizador', utilizadorSchema);
