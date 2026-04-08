var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');

var indexRouter      = require('./routes/index');
var recursosRouter   = require('./routes/recursos');
var postsRouter      = require('./routes/posts');
var utilizadoresRouter = require('./routes/utilizadores');
var authRouter       = require('./routes/auth');

var app = express();

// View engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Tornar o user disponível em todas as views
app.use((req, res, next) => {
    res.locals.user = req.cookies.user ? JSON.parse(req.cookies.user) : null;
    next();
});

app.use('/',            indexRouter);
app.use('/recursos',    recursosRouter);
app.use('/posts',       postsRouter);
app.use('/utilizadores', utilizadoresRouter);
app.use('/auth',        authRouter);

module.exports = app;