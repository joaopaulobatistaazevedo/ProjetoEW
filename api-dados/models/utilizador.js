const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const utilizadorSchema = new mongoose.Schema({
    username:         { type: String, required: true, unique: true },
    nome:             { type: String, required: true },
    email:            { type: String, required: true, unique: true },
    password:         { type: String, required: true },
    role:             { type: String, enum: ['admin', 'produtor', 'consumidor'], default: 'consumidor' },
    filiacao:         String,
    apiKey:           { type: String, unique: true, sparse: true },
    dataRegisto:      { type: Date, default: Date.now },
    dataUltimoAcesso: Date
});

// Hash automático da password antes de guardar
utilizadorSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

// Método para verificar password no login
utilizadorSchema.methods.verificarPassword = function (passwordEmTexto) {
    return bcrypt.compare(passwordEmTexto, this.password);
};

module.exports = mongoose.model('Utilizador', utilizadorSchema);