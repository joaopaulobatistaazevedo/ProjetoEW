const Utilizador = require('../models/utilizador');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Secret JWT (dev fallback)
const JWT_SECRET = process.env.JWT_SECRET || "jcr_secret_2026";

// Listar todos (sem password)
module.exports.list = () => {
    return Utilizador.find({}, { password: 0 }).sort({ nome: 1 }).exec();
};

// Ver um por ID (sem password)
module.exports.findById = id => {
    return Utilizador.findById(id, { password: 0 }).exec();
};

// Criar novo utilizador (hash da password)
module.exports.insert = async (u) => {
    const salt = await bcrypt.genSalt(10);
    u.password = await bcrypt.hash(u.password, salt);
    u.ativo = true;
    u.dataRegisto = new Date();
    const novo = new Utilizador(u);
    return novo.save();
};

// Atualizar utilizador (refaz hash se password mudar)
module.exports.update = async (id, u) => {
    if (u.password) {
        const salt = await bcrypt.genSalt(10);
        u.password = await bcrypt.hash(u.password, salt);
    }
    return Utilizador.findByIdAndUpdate(id, u, { new: true }).exec();
};

// Remover utilizador
module.exports.remove = id => {
    return Utilizador.findByIdAndDelete(id).exec();
};

// Login — verifica password e devolve token
module.exports.login = async (username, password) => {
    const user = await Utilizador.findOne({ username });
    if (!user) throw new Error('Utilizador não encontrado.');
    if (!user.ativo) throw new Error('Conta desativada.');

    const pwdOk = await bcrypt.compare(password, user.password);
    if (!pwdOk) throw new Error('Password incorreta.');

    // Atualizar dataUltimoAcesso
    user.dataUltimoAcesso = new Date();
    await user.save();

    // Token com expiracao curta
    const token = jwt.sign(
        { sub: user._id.toString(), username: user.username, nome: user.nome, role: user.role },
        JWT_SECRET,
        { expiresIn: '1h' }
    );

    return { token, user: { nome: user.nome, role: user.role } };
};

// Promover utilizador a produtor (consumidor → produtor)
module.exports.promoteToProdutor = async (id) => {
    const user = await Utilizador.findById(id);
    if (!user) throw new Error('Utilizador não encontrado.');
    if (user.role === 'consumidor') {
        user.role = 'produtor';
        await user.save();
    }
    return user;
};

// Promover utilizador a admin (apenas admin)
module.exports.promoteToAdmin = async (id) => {
    const user = await Utilizador.findById(id);
    if (!user) throw new Error('Utilizador não encontrado.');
    if (user.role !== 'admin') {
        user.role = 'admin';
        await user.save();
    }
    return user;
};