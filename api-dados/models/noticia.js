const mongoose = require('mongoose');

const noticiaSchema = new mongoose.Schema({
    titulo: { type: String, required: true },
    conteudo: { type: String },
    tipo: {
        type: String,
        enum: ['sistema', 'admin', 'novo_recurso', 'trending', 'comentarios', 'tipo_destaque', 'stats', 'milestone'],
        default: 'sistema'
    },
    link: { type: String }, // e.g. '/recursos/:id'
    autorNome: { type: String },
    dataCriacao: { type: Date, default: Date.now }
});

noticiaSchema.index({ dataCriacao: -1 });

module.exports = mongoose.model('Noticia', noticiaSchema);
