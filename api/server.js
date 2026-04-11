const express = require('express');
const mongoose = require('mongoose');
const app = express();

app.use(express.json());

// Logger
app.use((req, res, next) => {
    const d = new Date().toISOString().substring(0, 16);
    console.log(`${req.method} ${req.url} ${d}`);
    next();
});

// Conexão ao MongoDB
const nomeBD = "recursos_educativos";
const mongoHost = process.env.MONGO_URL || `mongodb://127.0.0.1:27017/${nomeBD}`;
mongoose.connect(mongoHost)
    .then(() => console.log(`MongoDB: liguei-me à base de dados ${nomeBD}.`))
    .catch(err => console.error('Erro:', err));

// Rotas
const recursosRouter    = require('./routes/recursos');
const utilizadoresRouter = require('./routes/utilizadores');
const postsRouter       = require('./routes/posts');
const authRouter = require('./routes/auth');

app.use('/recursos',     recursosRouter);
app.use('/utilizadores', utilizadoresRouter);
app.use('/posts',        postsRouter);
app.use('/auth', authRouter);

app.listen(3000, () => console.log('API a correr em http://localhost:3000'));