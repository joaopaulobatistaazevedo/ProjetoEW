const mongoose = require('mongoose');

const postSchema = new mongoose.Schema({
    titulo: String,
    conteudo: { type: String, required: true }, // texto do post
    autor: { type: mongoose.Schema.Types.ObjectId, ref: 'Utilizador' },
    recurso: { type: mongoose.Schema.Types.ObjectId, ref: 'Recurso' }, // recurso a que o post se refere
    dataPost: { type: Date, default: Date.now },
    comentarios: [{ // comentários embutidos no post
        autor: { type: mongoose.Schema.Types.ObjectId, ref: 'Utilizador' },
        conteudo: String,
        data: { type: Date, default: Date.now }
    }]
});

module.exports = mongoose.model('Post', postSchema);