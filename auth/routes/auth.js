const express = require('express');
const router = express.Router();
const axios = require('axios');
const jwt = require('jsonwebtoken');

// User registration
router.post('/register', async (req, res) => {
  try {
    const response = await axios.post('http://api-dados:3001/utilizadores', req.body);
    res.status(201).send(response.data);
  } catch (error) {
    res.status(400).send(error.response.data);
  }
});

// User login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const response = await axios.post('http://api-dados:3001/utilizadores/login', { username, password });
    const { user, token } = response.data;
    res.cookie('token', token, { httpOnly: true, maxAge: 3600000 });
    res.send({ message: 'Logged in successfully' });
  } catch (error) {
    res.status(401).send(error.response.data);
  }
});

// User logout
router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.send({ message: 'Logged out successfully' });
});

module.exports = router;
