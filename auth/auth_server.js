const express = require('express');
const mongoose = require('mongoose');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();

const PORT      = process.env.PORT      || 2623;
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/auth_service';

mongoose.connect(MONGO_URL)
    .then(() => console.log('Auth: MongoDB ligado com sucesso.'))
    .catch(err => {
        console.error('Auth: Erro crítico:', err.message);
        process.exit(1);
    });

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

const usersRouter = require('./routes/users');
app.use('/users', usersRouter);

app.get('/', (req, res) => {
    res.json({ data: new Date().toISOString(), status: `Auth a correr na porta ${PORT}` });
});

app.use((req, res) => {
    res.status(404).json({ erro: "Caminho não encontrado." });
});

app.use((err, req, res, next) => {
    console.error("ERRO:", err.stack);
    res.status(err.status || 500).json({ erro: err.message });
});

app.listen(PORT, () => console.log(`Auth Server a correr na porta ${PORT}`));