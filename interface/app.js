var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var jwt = require('jsonwebtoken');

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

// Middleware de verificação de autenticação
const COOKIE_NAME = process.env.COOKIE_NAME || 'auth_token_alunos';
const JWT_SECRET = process.env.JWT_SECRET || 'jcr_secret_2026';
const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || '/auth/login';

function verificarAutenticacao(req, res, next) {
    const token = req.cookies[COOKIE_NAME];
    if (!token) {
        return res.redirect(AUTH_SERVICE_URL);
    }
    jwt.verify(token, JWT_SECRET, (err, payload) => {
        if (err) {
            return res.redirect(AUTH_SERVICE_URL);
        } else {
            req.user = payload;
            res.locals.user = payload;
            next();
        }
    });
}

// Tornar o user disponível em todas as views (fallback)
app.use((req, res, next) => {
    if (!res.locals.user && req.cookies[COOKIE_NAME]) {
        try {
            const payload = jwt.verify(req.cookies[COOKIE_NAME], JWT_SECRET);
            res.locals.user = payload;
        } catch {}
    }
    next();
});

// Rotas públicas
app.use('/', indexRouter);
app.use('/auth', authRouter);

// Rotas protegidas
app.use('/recursos', verificarAutenticacao, recursosRouter);
app.use('/posts', verificarAutenticacao, postsRouter);
app.use('/utilizadores', verificarAutenticacao, utilizadoresRouter);

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
  res.status(err.status || 500);
  res.render('error');
});

const PORT = process.env.PORT || 8080;
const API_URL = process.env.API_URL || 'http://localhost:3001';

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Interface a correr na porta ${PORT}`);
    console.log(`API_URL: ${API_URL}`);
});