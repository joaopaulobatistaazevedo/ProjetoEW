const mongoose = require('mongoose');

// Post de discussao associado a recurso
const postSchema = new mongoose.Schema({
    titulo:   String,
    conteudo: { type: String, required: true },
    autor:    { type: mongoose.Schema.Types.ObjectId, ref: 'Utilizador' },
    recurso:  { type: mongoose.Schema.Types.ObjectId, ref: 'Recurso' },
    dataPost: { type: Date, default: Date.now },
    comentarios: [{
        autor:    { type: mongoose.Schema.Types.ObjectId, ref: 'Utilizador' },
        conteudo: { type: String, required: true},
        data:     { type: Date, default: Date.now }
    }]
});

// Índices úteis
postSchema.index({ recurso: 1 });
postSchema.index({ autor: 1 });

module.exports = mongoose.model('Post', postSchema);