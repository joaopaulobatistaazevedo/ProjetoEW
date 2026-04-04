const mongoose = require('mongoose');

const recursoSchema = new mongoose.Schema({
    titulo: { type: String, required: true },
    subtitulo: String,
    tipo: { type: String, enum: ['artigo', 'tese', 'slides', 'teste', 'relatorio', 'aplicacao'], required: true },
    dataCriacao: Date, // data em que o recurso foi criado pelo autor
    dataRegisto: { type: Date, default: Date.now }, // data de entrada no sistema
    visibilidade: { type: String, enum: ['publico', 'privado'], default: 'publico' },
    produtor: { type: mongoose.Schema.Types.ObjectId, ref: 'Utilizador' }, // autor do recurso
    hashtags: [String], // ex: ['programação', 'C', 'algoritmos']
    ficheiro: String, // caminho para o ficheiro em api/uploads/
    rating: { type: Number, default: 0 } // média das estrelas atribuídas
});

module.exports = mongoose.model('Recurso', recursoSchema);