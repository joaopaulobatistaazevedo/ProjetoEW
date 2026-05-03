const swaggerUi = require('swagger-ui-express');

const PORT = process.env.PORT || 2623;
const SWAGGER_URL = process.env.SWAGGER_URL || 'http://localhost:3002';

const swaggerSpec = {
    openapi: '3.0.3',
    info: {
        title: 'Auth Service API',
        version: '1.0.0',
        description: 'Documentacao dos endpoints do servico auth.'
    },
    servers: [
        {
            url: SWAGGER_URL,
            description: 'Auth Service'
        }
    ],
    components: {
        securitySchemes: {
            bearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT'
            }
        }
    },
    paths: {
        '/users/register': {
            post: {
                summary: 'Criar conta de utilizador',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    username: { type: 'string' },
                                    nome: { type: 'string' },
                                    email: { type: 'string' },
                                    password: { type: 'string' },
                                    role: { type: 'string', enum: ['admin', 'produtor', 'consumidor'] },
                                    filiacao: { type: 'string' }
                                },
                                required: ['username', 'nome', 'email', 'password']
                            }
                        }
                    }
                },
                responses: {
                    '201': { description: 'Conta criada com sucesso' },
                    '400': { description: 'Pedido invalido' }
                }
            }
        },
        '/users/login': {
            post: {
                summary: 'Autenticar utilizador',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    username: { type: 'string' },
                                    password: { type: 'string' }
                                },
                                required: ['username', 'password']
                            }
                        }
                    }
                },
                responses: {
                    '200': { description: 'Login com sucesso' },
                    '401': { description: 'Credenciais invalidas' }
                }
            }
        },
        '/users/logout': {
            get: {
                summary: 'Terminar sessao',
                responses: {
                    '200': { description: 'Sessao terminada' }
                }
            }
        },
        '/users': {
            get: {
                summary: 'Listar utilizadores',
                security: [{ bearerAuth: [] }],
                responses: {
                    '200': { description: 'Lista de utilizadores' },
                    '401': { description: 'Nao autenticado' }
                }
            }
        },
        '/users/{id}': {
            get: {
                summary: 'Obter utilizador por ID',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
                ],
                responses: {
                    '200': { description: 'Utilizador encontrado' },
                    '404': { description: 'Utilizador nao encontrado' }
                }
            },
            put: {
                summary: 'Atualizar utilizador',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { type: 'object' }
                        }
                    }
                },
                responses: {
                    '200': { description: 'Utilizador atualizado' },
                    '401': { description: 'Nao autenticado' }
                }
            },
            delete: {
                summary: 'Apagar utilizador',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
                ],
                responses: {
                    '200': { description: 'Utilizador removido' },
                    '401': { description: 'Nao autenticado' }
                }
            }
        }
    }
};

function setupSwagger(app) {
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
    app.get('/docs.json', (req, res) => {
        res.json(swaggerSpec);
    });
}

module.exports = setupSwagger;
