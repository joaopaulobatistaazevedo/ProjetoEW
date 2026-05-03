const mongoose = require('mongoose')

const fileSchema = new mongoose.Schema({
    originalName: {type: String, required: true, trim: true},
    storageName: {type: String, required: true, unique: true},
    path: {type: String, required: true},
    mimeType: {type: String, required: true},
    size: {type: Number, required: true},
    tags: [{type: String, lowercase: true}],
    category: {type: String, default: "geral"},
    description: {type: String, trim: true}
}, {timestamps: true})

fileSchema.index({originalName: 'text', tags: 'text'}) 

module.exports = mongoose.model('File', fileSchema)