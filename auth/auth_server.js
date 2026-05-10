const express = require('express');
const mongoose = require('mongoose');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const path = require('path');
const setupSwagger = require('./swagger');

const app = express();

// Config
const PORT      = process.env.PORT      || 2623;
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/auth_service';

async function ligarMongoComRetry(tentativas = 20, intervaloMs = 3000) {
    let ultimoErro = null;

    for (let i = 1; i <= tentativas; i++) {
        try {
            await mongoose.connect(MONGO_URL, {
                useNewUrlParser: true,
                useUnifiedTopology: true,
                useCreateIndex: true,
                useFindAndModify: false
            });
            return;
        } catch (err) {
            ultimoErro = err;
            console.error(`Auth: tentativa ${i}/${tentativas} falhou ao ligar ao MongoDB:`, err.message);

            if (i < tentativas) {
                await new Promise(resolve => setTimeout(resolve, intervaloMs));
            }
        }
    }

    throw ultimoErro;
}

// MongoDB connection
async function iniciarAuth() {
    try {
        await ligarMongoComRetry();
        console.log('Auth: MongoDB ligado com sucesso.');
        await ensureBaseAdmin();

        app.listen(PORT, () => console.log(`Auth Server a correr na porta ${PORT}`));
    } catch (err) {
        console.error('Auth: Erro crítico ao ligar ao MongoDB:', err.message);
        process.exit(1);
    }
}

// Garantir existencia de utilizador admin base
const Utilizador = require('./models/utilizador');
const bcrypt = require('bcryptjs');
async function ensureBaseAdmin() {
    try {
        const admin = await Utilizador.findOne({ role: 'admin' }).exec();
        if (!admin) {
            const password = process.env.BASE_ADMIN_PASS || 'admin';
            const salt = await bcrypt.genSalt(10);
            const hash = await bcrypt.hash(password, salt);
            const novo = new Utilizador({
                username: process.env.BASE_ADMIN_USER || 'admin',
                nome: process.env.BASE_ADMIN_NOME || 'admin',
                email: process.env.BASE_ADMIN_EMAIL || 'admin@local',
                password: hash,
                role: 'admin',
                filiacao: process.env.BASE_ADMIN_FILIACAO || 'admin'
            });
            await novo.save();
            console.log('Auth: Utilizador admin base criado (username/password = admin/admin por defeito).');
        } else {
            console.log('Auth: Já existe pelo menos um admin.');
        }
    } catch (err) {
        console.error('Auth: Erro ao garantir admin base:', err.message);
    }
}

// Middleware pipeline
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
setupSwagger(app);

// Routes
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

iniciarAuth();