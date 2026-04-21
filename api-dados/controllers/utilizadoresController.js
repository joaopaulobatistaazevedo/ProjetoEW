const Utilizador = require('../models/utilizador');

const utilizadoresController = {

    // GET /utilizadores - listar todos
    getAllUtilizadores: async (req, res) => {
        try {
            const utilizadores = await Utilizador.find({}, '-password'); // esconde a password
            res.json(utilizadores);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    },

    // GET /utilizadores/:id - ver um utilizador
    getUtilizadorById: async (req, res) => {
        try {
            const utilizador = await Utilizador.findById(req.params.id, '-password');
            if (!utilizador) return res.status(404).json({ error: 'Não encontrado' });
            res.json(utilizador);
        } catch (err) {
            res.status(400).json({ error: 'ID inválido' });
        }
    },

    // POST /utilizadores - criar utilizador
    createUtilizador: async (req, res) => {
        try {
            const utilizador = new Utilizador(req.body);
            const saved = await utilizador.save();
            res.status(201).json(saved);
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    },

    // PUT /utilizadores/:id - editar utilizador
    updateUtilizador: async (req, res) => {
        try {
            const updated = await Utilizador.findByIdAndUpdate(req.params.id, req.body, { new: true });
            if (!updated) return res.status(404).json({ error: 'Não encontrado' });
            res.json(updated);
        } catch (err) {
            res.status(400).json({ error: err.message });
        }
    },

    // DELETE /utilizadores/:id - apagar utilizador
    deleteUtilizador: async (req, res) => {
        try {
            const deleted = await Utilizador.findByIdAndDelete(req.params.id);
            if (!deleted) return res.status(404).json({ error: 'Não encontrado' });
            res.json({ message: 'Eliminado com sucesso', id: req.params.id });
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }

};

module.exports = utilizadoresController;
