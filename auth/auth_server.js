const express = require('express');
const morgan = require('morgan');
const axios = require('axios');
const path = require('path');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');

const app = express();

// --- Configurações por Variáveis de Ambiente ---
const PORT = process.env.PORT || 2623;
const DATA_API_URL = process.env.DATA_API_URL || "http://api-dados:3001/utilizadores";
const JWT_SECRET = process.env.JWT_SECRET || "jcr_secret_2026";
const COOKIE_NAME = process.env.COOKIE_NAME || "auth_token_alunos";
const APP_PUBS_URL = process.env.APP_PUBS_URL || "http://localhost:2622";

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(express.static('public'));

// --- Middleware de Proteção ---
function verificaAcesso(req, res, next) {
  const token = req.cookies[COOKIE_NAME];
  if (!token) return res.status(401).redirect('/users/login');
  else
    jwt.verify(token, JWT_SECRET, (err, payload) => {
      if (err) return res.status(401).redirect('/users/login');
      else{
        req.user = payload;
        next();
      }
    });
}

// --- Rotas Protegidas ---
app.get('/users', verificaAcesso, async (req, res) => {
  try{
    const response = await axios.get(DATA_API_URL);
    res.render('utilizadores', { titulo: "Lista de Utilizadores", users: response.data });
  } catch (error) {
    res.status(500).render('error', { message: "Erro na API de Dados" });
  }
});

// --- Rotas Abertas ---

app.get('/users/login', (req, res) => {
  res.render('login', { titulo: "Página de Login", redirectTo: APP_PUBS_URL });
});

app.get('/users/register', (req, res) => {
  res.render('registo', { titulo: "Criar Nova Conta" });
});

// Rota de Login: Gera o JWT e guarda no Cookie
app.post('/users/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const response = await axios.get(`${DATA_API_URL}?username=${username}&password=${password}`);
    const users = response.data;

    if (users.length > 0) {
      const user = users[0];
      const token = jwt.sign(
        { sub: user.id, username: user.username, nome: user.nome, role: user.role },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        maxAge: 3600000
      });

      return res.json({
        success: true,
        message: "Login bem sucedido",
        redirectTo: APP_PUBS_URL
      });
    } else {
      res.render('login', { error: "Credenciais inválidas", titulo: "Página de Login" });
    }
  } catch (error) {
    res.status(500).render('error', { message: "Erro na API de Dados" });
  }
});

// Logout: Apaga o cookie
app.get('/users/logout', verificaAcesso, (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.redirect('/users/login');
});

app.listen(PORT, () => {
  console.log(`Auth Server a correr na porta ${PORT}`);
});
