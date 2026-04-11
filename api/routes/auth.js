const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const Utilizador = require('../models/utilizador');

const SECRET = process.env.JWT_SECRET || 'segredo';

// POST /auth/registo
router.post('/registo', async (req, res) => {
    try {
        const utilizador = new Utilizador(req.body);
        await utilizador.save();
        res.status(201).json({ mensagem: 'Conta criada com sucesso' });
    } catch (err) {
        res.status(400).json({ erro: err.message });
    }
});

// POST /auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const utilizador = await Utilizador.findOne({ email });
        if (!utilizador) return res.status(401).json({ erro: 'Credenciais inválidas' });

        const valida = await utilizador.verificarPassword(password);
        if (!valida) return res.status(401).json({ erro: 'Credenciais inválidas' });

        utilizador.dataUltimoAcesso = new Date();
        await utilizador.save();

        const token = jwt.sign(
            { id: utilizador._id, role: utilizador.role },
            SECRET,
            { expiresIn: '8h' }
        );

        res.json({
            token,
            utilizador: {
                id: utilizador._id,
                nome: utilizador.nome,
                email: utilizador.email,
                role: utilizador.role
            }
        });
    } catch (err) {
        res.status(500).json({ erro: err.message });
    }
});

module.exports = router;