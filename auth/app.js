const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const logger = require('morgan');
const authRoutes = require('./routes/auth');

const app = express();

const mongoURI = process.env.MONGO_URL || 'mongodb://mongodb_auth:27017/authdb';
mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('MongoDB connected for auth service...'))
  .catch(err => console.log(err));

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

app.use('/', authRoutes);

const port = process.env.PORT || 3002;
app.listen(port, () => console.log(`Auth service running on port ${port}`));

module.exports = app;
