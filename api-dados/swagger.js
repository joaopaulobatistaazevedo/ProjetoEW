const swaggerUi = require('swagger-ui-express');

const PORT = process.env.PORT || 3001;

const swaggerSpec = {
    openapi: '3.0.3',
    info: {
        title: 'API de Dados - Recursos Educativos',
        version: '1.0.0',
        description: 'Documentacao dos endpoints do servico api-dados.'
    },
    servers: [
        {
            url: `http://localhost:${PORT}`,
            description: 'Servidor local'
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
        '/api/files': {
            get: {
                summary: 'Listar ficheiros',
                parameters: [
                    { name: 'search', in: 'query', schema: { type: 'string' } },
                    { name: 'category', in: 'query', schema: { type: 'string' } }
                ],
                responses: { '200': { description: 'Lista de ficheiros' } }
            }
        },
        '/api/files/upload': {
            post: {
                summary: 'Upload de ficheiro',
                requestBody: {
                    required: true,
                    content: {
                        'multipart/form-data': {
                            schema: {
                                type: 'object',
                                properties: {
                                    file: { type: 'string', format: 'binary' },
                                    tags: { type: 'string' },
                                    category: { type: 'string' }
                                },
                                required: ['file']
                            }
                        }
                    }
                },
                responses: {
                    '201': { description: 'Ficheiro criado' },
                    '400': { description: 'Nenhum ficheiro enviado' }
                }
            }
        },
        '/api/files/download/{id}': {
            get: {
                summary: 'Download de ficheiro',
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
                ],
                responses: { '200': { description: 'Ficheiro enviado' }, '404': { description: 'Nao encontrado' } }
            }
        },
        '/api/files/{id}': {
            delete: {
                summary: 'Remover ficheiro',
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
                ],
                responses: { '200': { description: 'Removido' }, '404': { description: 'Nao encontrado' } }
            }
        },
        '/recursos': {
            get: {
                summary: 'Listar recursos',
                parameters: [
                    { name: 'tipo', in: 'query', schema: { type: 'string' } },
                    { name: 'hashtag', in: 'query', schema: { type: 'string' } },
                    { name: 'ano', in: 'query', schema: { type: 'string' } },
                    { name: 'visibilidade', in: 'query', schema: { type: 'string' } }
                ],
                responses: { '200': { description: 'Lista de recursos' } }
            },
            post: {
                summary: 'Criar recurso',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { type: 'object' }
                        }
                    }
                },
                responses: {
                    '201': { description: 'Recurso criado' },
                    '401': { description: 'Nao autenticado' },
                    '403': { description: 'Sem permissao' }
                }
            }
        },
        '/recursos/top3': {
            get: {
                summary: 'Top 3 recursos',
                responses: { '200': { description: 'Top 3 por media de estrelas' } }
            }
        },
        '/recursos/{id}': {
            get: {
                summary: 'Detalhe de recurso',
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
                ],
                responses: { '200': { description: 'Detalhe do recurso' }, '404': { description: 'Nao encontrado' } }
            },
            put: {
                summary: 'Editar recurso',
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
                responses: { '200': { description: 'Atualizado' }, '401': { description: 'Nao autenticado' } }
            },
            delete: {
                summary: 'Apagar recurso',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
                ],
                responses: { '200': { description: 'Removido' }, '401': { description: 'Nao autenticado' } }
            }
        },
        '/recursos/{id}/download': {
            get: {
                summary: 'Download de recurso',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
                ],
                responses: { '200': { description: 'Ficheiro enviado' }, '403': { description: 'Sem permissao' } }
            }
        },
        '/recursos/{id}/rate': {
            patch: {
                summary: 'Avaliar recurso',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    estrelas: { type: 'integer', minimum: 1, maximum: 5 }
                                },
                                required: ['estrelas']
                            }
                        }
                    }
                },
                responses: { '200': { description: 'Avaliacao registada' }, '400': { description: 'Dados invalidos' } }
            }
        },
        '/posts': {
            get: {
                summary: 'Listar posts',
                parameters: [
                    { name: 'recurso', in: 'query', schema: { type: 'string' } }
                ],
                responses: { '200': { description: 'Lista de posts' } }
            },
            post: {
                summary: 'Criar post',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: { type: 'object' }
                        }
                    }
                },
                responses: { '201': { description: 'Post criado' }, '401': { description: 'Nao autenticado' } }
            }
        },
        '/posts/{id}': {
            get: {
                summary: 'Detalhe de post',
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
                ],
                responses: { '200': { description: 'Detalhe do post' }, '404': { description: 'Nao encontrado' } }
            },
            put: {
                summary: 'Editar post',
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
                responses: { '200': { description: 'Atualizado' }, '401': { description: 'Nao autenticado' } }
            },
            delete: {
                summary: 'Apagar post',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } }
                ],
                responses: { '200': { description: 'Removido' }, '401': { description: 'Nao autenticado' } }
            }
        },
        '/posts/{id}/comentarios': {
            post: {
                summary: 'Adicionar comentario a um post',
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
                responses: { '201': { description: 'Comentario criado' }, '401': { description: 'Nao autenticado' } }
            }
        },
        '/posts/{id}/comentarios/{cid}': {
            delete: {
                summary: 'Remover comentario',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
                    { name: 'cid', in: 'path', required: true, schema: { type: 'string' } }
                ],
                responses: { '200': { description: 'Comentario removido' }, '401': { description: 'Nao autenticado' } }
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
