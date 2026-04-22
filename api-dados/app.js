var createError = require('http-errors');
var express = require('express');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var mongoose = require('mongoose');

var app = express();

const nomeBD   = "recursos_educativos";
const mongoURI = process.env.MONGO_URL || `mongodb://localhost:27017/${nomeBD}`;

mongoose.connect(mongoURI)
    .then(() => console.log(`MongoDB: Conectado à base de dados ${nomeBD}.`))
    .catch(err => {
        console.error('MongoDB: Erro crítico:', err.message);
        process.exit(1);
    });

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

const recursosRouter = require('./routes/recursos');
const postsRouter    = require('./routes/posts');

app.use('/recursos', recursosRouter);
app.use('/posts',    postsRouter);

app.get('/', (req, res) => {
    res.json({ data: new Date().toISOString(), status: 'API de dados a correr...' });
});

app.use(function(req, res, next) { next(createError(404)); });

app.use(function(err, req, res, next) {
    res.status(err.status || 500).json({ error: err.message });
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`API de dados a correr na porta ${port}`));

module.exports = app;