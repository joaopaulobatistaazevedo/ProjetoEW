const mongoose = require('mongoose');

const recursoSchema = new mongoose.Schema({
    titulo:       { type: String, required: true },
    subtitulo:    String,
    tipo:         {
        type: String,
        enum: ['artigo', 'tese', 'slides', 'teste', 'relatorio', 'aplicacao', 'problema', 'outro'],
        required: true
    },
    dataCriacao:  Date,                              // data em que o autor criou o recurso
    dataRegisto:  { type: Date, default: Date.now }, // data de entrada no sistema
    visibilidade: { type: String, enum: ['publico', 'privado'], default: 'publico' },
    produtor:     { type: mongoose.Schema.Types.ObjectId, ref: 'Utilizador', required: true },
    hashtags:     [String],                          // ex: ['programação', 'C', 'algoritmos']
    ficheiro:     String,                            // caminho para o ficheiro em api/uploads/

    // Array de votos — permite calcular média e impedir votos duplos
    ratings: [{
        utilizador: { type: mongoose.Schema.Types.ObjectId, ref: 'Utilizador' },
        estrelas:   { type: Number, min: 1, max: 5 }
    }],
    mediaEstrelas: { type: Number, default: 0 }      // atualizado automaticamente
});

// Recalcula a média sempre que o documento é guardado
recursoSchema.pre('save', function (next) {
    if (this.ratings.length === 0) {
        this.mediaEstrelas = 0;
    } else {
        const total = this.ratings.reduce((sum, r) => sum + r.estrelas, 0);
        this.mediaEstrelas = +(total / this.ratings.length).toFixed(1);
    }
    next();
});

module.exports = mongoose.model('Recurso', recursoSchema);