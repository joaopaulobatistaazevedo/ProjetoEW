const mongoose = require('mongoose');

// AIP: snapshot de ingestao e validacoes
// Suporta versionamento para histórico completo
const aipSchema = new mongoose.Schema({
    sipId: {
        type: String,
        required: true,
        index: true
        // Nota: sipId pode não ser único se houver múltiplas versões
        // Chave composta única: { recursoId, versao }
    },
    recursoId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Recurso',
        index: true,
        required: true
    },
    // Versionamento de AIP
    versao: {
        type: Number,
        default: 1,
        required: true
    },
    // Referência ao AIP anterior para rastreabilidade
    aipAnterior: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AIP'
    },
    // Motivo da atualização
    motivoAtualizacao: {
        type: String,
        enum: ['ingestao_inicial', 'ficheiro_corrigido', 'metadados_atualizados', 'manutencao_sistema'],
        default: 'ingestao_inicial'
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

// Índice composto único para versionamento: { recursoId, versao }
aipSchema.index({ recursoId: 1, versao: 1 }, { unique: true });

module.exports = mongoose.model('AIP', aipSchema);
