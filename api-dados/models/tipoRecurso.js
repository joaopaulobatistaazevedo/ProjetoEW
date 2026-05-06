const mongoose = require('mongoose');

const tipoRecursoSchema = new mongoose.Schema({
    slug: {
        type: String,
        required: true,
        unique: true,
        trim: true,
        lowercase: true
    },
    nome: {
        type: String,
        required: true,
        trim: true
    },
    descricao: {
        type: String,
        default: ''
    },
    ativo: {
        type: Boolean,
        default: true
    },
    sistema: {
        type: Boolean,
        default: false
    },
    ordem: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

tipoRecursoSchema.index({ nome: 1 });
tipoRecursoSchema.index({ ativo: 1, ordem: 1, nome: 1 });

module.exports = mongoose.model('TipoRecurso', tipoRecursoSchema);
