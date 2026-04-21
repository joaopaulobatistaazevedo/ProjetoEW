var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var mongoose = require('mongoose');

var app = express();

const nomeBD = "recursos_educativos";
const mongoURI = process.env.MONGO_URL || `mongodb://mongodb_api:27017/${nomeBD}`;
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log(`MongoDB: Conectado à base de dados ${nomeBD}.`))
    .catch(err => console.error('MongoDB: Erro de conexão:', err));

app.use(logger('dev'));
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

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500).json({ error: err.message });
});

const port = process.env.PORT || 3001;
app.listen(port, () => console.log(`API de dados a correr na porta ${port}`));

module.exports = app;
