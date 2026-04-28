const express = require('express')
const mongoose = require('mongoose')
const fileRoutes = require('./routes/fileRoutes')
const fs = require('fs')

const swaggerUi = require('swagger-ui-express');
const YAML = require('yamljs');
const swaggerDocument = YAML.load('./swagger.yaml');

const app = express()

app.use(express.json())
app.use(express.urlencoded({extended: true}))

if(!fs.existsSync('./uploads')){
    fs.mkdirSync('./uploads')
}

app.use('/api/files', fileRoutes)
app.use('/api-files-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

mongoose.connect('mongodb://mongodb:27017/gficheiros')
    .then(()=>{
        app.listen(19001, () => console.log(`Servidor à escuta em 19001...`))
    })
    .catch(erro => console.error('Erro ao ligar ao Mongo: ', erro))