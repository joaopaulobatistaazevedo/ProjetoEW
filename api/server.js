const express = require('express')
const mongoose = require('mongoose')

const app = express()
const PORT = 3000

app.use(express.json())

mongoose.connect('mongodb://localhost:27017/recursos_educativos')
  .then(() => console.log('MongoDB ligado'))
  .catch(err => console.error('Erro ao ligar ao MongoDB:', err))

app.listen(PORT, () => {
  console.log(`API a correr em http://localhost:${PORT}`)
})