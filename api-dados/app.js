// Core deps and swagger
var createError = require('http-errors');
var express = require('express');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var mongoose = require('mongoose');
const setupSwagger = require('./swagger');
const { ensureTiposRecursoBase } = require('./services/tiposRecursoService');

var app = express();

// DB config
const nomeBD   = "recursos_educativos";
const mongoURI = process.env.MONGO_URL || `mongodb://localhost:27017/${nomeBD}`;

// MongoDB connection
mongoose.connect(mongoURI)
    .then(async () => {
        console.log(`MongoDB: Conectado à base de dados ${nomeBD}.`);
        await ensureTiposRecursoBase();
        console.log('MongoDB: Tipos de recurso base verificados.');
    })
    .catch(err => {
        console.error('MongoDB: Erro crítico:', err.message);
        process.exit(1);
    });

// Middleware pipeline
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
setupSwagger(app);

// Regista modelos necessarios para populate.
require('./models/utilizador');
require('./models/aip');
require('./models/exportacao');
require('./models/tipoRecurso');

// Route modules
const recursosRouter = require('./routes/recursos');
const postsRouter    = require('./routes/posts');
const ingestaoRouter = require('./routes/ingestao');
const disseminacaoRouter = require('./routes/disseminacao');
const tiposRecursoRouter = require('./routes/tiposRecurso');

app.use('/recursos',     recursosRouter);
app.use('/posts',        postsRouter);
app.use('/ingestao',     ingestaoRouter);
app.use('/disseminacao', disseminacaoRouter);
app.use('/tipos-recurso', tiposRecursoRouter);

// Health check
app.get('/', (req, res) => {
    res.json({ data: new Date().toISOString(), status: 'API de dados a correr...' });
});

// 404 and error handler
app.use(function(req, res, next) { next(createError(404)); });

app.use(function(err, req, res, next) {
    res.status(err.status || 500).json({ error: err.message });
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`API de dados a correr na porta ${port}`));

module.exports = app;
