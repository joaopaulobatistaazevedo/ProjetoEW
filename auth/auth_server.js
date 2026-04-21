const express = require('express');
const morgan = require('morgan');
const path = require('path');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const Utilizador = require('./models/utilizador');

const app = express();

// --- Configurações por Variáveis de Ambiente ---
const PORT = process.env.PORT || 2623;
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/auth_service';
const JWT_SECRET = process.env.JWT_SECRET || "jcr_secret_2026";
const COOKIE_NAME = process.env.COOKIE_NAME || "auth_token_alunos";
const APP_PUBS_URL = process.env.APP_PUBS_URL || "http://localhost:2622";

mongoose
  .connect(MONGO_URL, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Auth: MongoDB ligado com sucesso.'))
  .catch((err) => console.error('Auth: erro a ligar ao MongoDB:', err));

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
    const users = await Utilizador.find({}, '-password').sort({ nome: 1 });
    res.render('utilizadores', { titulo: "Lista de Utilizadores", users });
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

// Rota de Registo: cria utilizador no serviço auth
app.post('/users/register', async (req, res) => {
  const { username, nome, email, password, role, filiacao } = req.body;

  try {
    const novo = await Utilizador.create({
      username,
      nome,
      email,
      password,
      role,
      filiacao,
      ativo: true,
      dataRegisto: new Date()
    });

    const token = jwt.sign(
      { sub: novo._id.toString(), username: novo.username, nome: novo.nome, role: novo.role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    return res.status(201).json({ token });
  } catch (err) {
    return res.status(400).json({
      success: false,
      message: 'Erro ao criar conta'
    });
  }
});

// Rota de Login: devolve JWT para a interface guardar em cookie
app.post('/users/login', async (req, res) => {
  const { username, password } = req.body;

  try {
    const user = await Utilizador.findOne({ username, password });
    if (!user) return res.status(401).json({ message: 'Credenciais inválidas' });

    const token = jwt.sign(
      { sub: user._id.toString(), username: user.username, nome: user.nome, role: user.role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    return res.status(201).json({ token });
  } catch (err) {
    return res.status(500).json({ message: 'Erro interno no login' });
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
