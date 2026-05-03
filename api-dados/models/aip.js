const mongoose = require('mongoose');

const aipSchema = new mongoose.Schema({
    sipId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    recursoId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Recurso',
        index: true
    },
    status: {
        type: String,
        enum: ['ok', 'erro'],
        required: true
    },
    dataIngestao: {
        type: Date,
        default: Date.now,
        index: true
    },
    produtor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Utilizador',
        required: true,
        index: true
    },
    manifesto: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    validacoes: {
        estrutura: {
            ok: Boolean,
            detalhes: String
        },
        metadados: {
            ok: Boolean,
            detalhes: String
        },
        seguranca: {
            ok: Boolean,
            detalhes: String
        },
        consistencia: {
            ok: Boolean,
            detalhes: String
        }
    },
    storageLocal: String,
    relatorio: {
        dataValidacao: Date,
        erros: [
            {
                categoria: { type: String, enum: ['estrutura', 'metadados', 'seguranca', 'consistencia'] },
                mensagem: String,
                campo: String
            }
        ],
        avisos: [String]
    },
    checksumSIP: String,
    downloadCount: {
        type: Number,
        default: 0
    }
});

module.exports = mongoose.model('AIP', aipSchema);
