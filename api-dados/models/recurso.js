const mongoose = require('mongoose');

// Recurso educativo publicado na plataforma
const recursoSchema = new mongoose.Schema({
    titulo:       { type: String, required: true },
    descricao:    { type: String },
    subtitulo:    String,
    tipo:         { type: String, required: true, trim: true, lowercase: true },
    dataCriacao:  Date,
    dataRegisto:  { type: Date, default: Date.now },
    visibilidade: { type: String, enum: ['publico', 'privado'], default: 'publico' },
    autor:        { type: mongoose.Schema.Types.ObjectId, ref: 'Utilizador', required: true },
    hashtags:     [String],
    ficheiro:     String,
    ratings: [{
        utilizador: { type: mongoose.Schema.Types.ObjectId, ref: 'Utilizador' },
        estrelas:   { type: Number, min: 1, max: 5 }
    }],
    mediaEstrelas: { type: Number, default: 0 }
});

recursoSchema.pre('save', function (next) {
    if (this.ratings.length === 0) {
        this.mediaEstrelas = 0;
    } else {
        const total = this.ratings.reduce((sum, r) => sum + r.estrelas, 0);
        this.mediaEstrelas = +(total / this.ratings.length).toFixed(1);
    }
    next();
});

// Índices para acelerar consultas por campos comuns
recursoSchema.index({ tipo: 1 });
recursoSchema.index({ visibilidade: 1 });
recursoSchema.index({ autor: 1 });
recursoSchema.index({ dataRegisto: -1 });
recursoSchema.index({ mediaEstrelas: -1 });
recursoSchema.index({ hashtags: 1 });
recursoSchema.index({ titulo: 'text', subtitulo: 'text', descricao: 'text', hashtags: 'text' });

module.exports = mongoose.model('Recurso', recursoSchema);
