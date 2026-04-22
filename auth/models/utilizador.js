const mongoose = require('mongoose');

const utilizadorSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  nome: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'produtor', 'consumidor'], default: 'consumidor' },
  filiacao: String,
  dataRegisto: { type: Date, default: Date.now },
  ativo: { type: Boolean, default: true }
}, { versionKey: false });

module.exports = mongoose.model('Utilizador', utilizadorSchema);