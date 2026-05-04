const mongoose = require('mongoose');

const exportacaoSchema = new mongoose.Schema({
    // Identificadores
    aipId: {
        type: String,
        required: true,
        index: true
    },
    recursoId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Recurso',
        required: true,
        index: true
    },
    
    // Quem exportou e quando
    exportadoPor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Utilizador',
        required: true,
        index: true
    },
    dataExportacao: {
        type: Date,
        default: Date.now,
        index: true
    },
    
    // Formato e opções
    formato: {
        type: String,
        enum: ['zip', 'json', 'html', 'pdf'],
        default: 'zip'
    },
    incluirMetadados: {
        type: Boolean,
        default: true
    },
    
    // Filtros aplicados
    filtrosAplicados: {
        visibilidade: String,
        ficheirosIncluidos: Number,
        ficheirosExcluidos: Number,
        motivosExclusao: [String]
    },
    
    // Metadados da exportação
    tamanhoZIP: Number,  // em bytes
    checksumDIP: String, // SHA-256 do ZIP
    tempoProcessamento: Number, // em ms
    
    // Status
    status: {
        type: String,
        enum: ['sucesso', 'erro'],
        default: 'sucesso'
    },
    erroMensagem: String,
    
    // Rastreabilidade
    ipSolicitante: String,
    userAgent: String
});

// Índices para auditoria eficiente
exportacaoSchema.index({ exportadoPor: 1, dataExportacao: -1 });
exportacaoSchema.index({ recursoId: 1, dataExportacao: -1 });
exportacaoSchema.index({ dataExportacao: -1 });
exportacaoSchema.index({ status: 1 });

module.exports = mongoose.model('Exportacao', exportacaoSchema);
