const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');

const app = express();

// Custom Logger
app.use((req, res, next) => {
    const d = new Date().toISOString().substring(0, 16);
    console.log(`${req.method} ${req.url} ${d}`);
    next();
});

const nomeBD = "recursos_educativos";
const mongoURI = process.env.MONGO_URL || `mongodb://mongodb_api:27017/${nomeBD}`;
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log(`MongoDB: Conectado à base de dados ${nomeBD}.`))
    .catch(err => console.error('MongoDB: Erro de conexão:', err));

app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Rotas
const recursosRouter = require('./routes/recursos');
const utilizadoresRouter = require('./routes/utilizadores');
const postsRouter = require('./routes/posts');

app.use('/recursos', recursosRouter);
app.use('/utilizadores', utilizadoresRouter);
app.use('/posts', postsRouter);

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`API de dados a correr na porta ${port}`));

module.exports = app;