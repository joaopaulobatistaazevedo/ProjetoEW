const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
    titulo:   String,
    conteudo: { type: String, required: true },
    autor:    { type: mongoose.Schema.Types.ObjectId, ref: 'Utilizador' },
    recurso:  { type: mongoose.Schema.Types.ObjectId, ref: 'Recurso' },
    dataPost: { type: Date, default: Date.now },
    comentarios: [{
        autor:    { type: mongoose.Schema.Types.ObjectId, ref: 'Utilizador' },
        conteudo: String,
        data:     { type: Date, default: Date.now }
    }]
});

module.exports = mongoose.model('Post', postSchema);