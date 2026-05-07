// Swagger UI setup
const swaggerUi = require('swagger-ui-express');

const PORT = process.env.PORT || 3001;

// OpenAPI spec object
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
        '/recursos': {
            get: {
                summary: 'Listar recursos',
                parameters: [
                    { name: 'q', in: 'query', schema: { type: 'string' }, description: 'Pesquisa textual em titulo, subtitulo, descricao e hashtags.' },
                    { name: 'tipo', in: 'query', schema: { type: 'string' } },
                    { name: 'hashtag', in: 'query', schema: { type: 'string' } },
                    { name: 'ano', in: 'query', schema: { type: 'string' } },
                    { name: 'visibilidade', in: 'query', schema: { type: 'string' } },
                    { name: 'autor', in: 'query', schema: { type: 'string' } },
                    { name: 'produtor', in: 'query', schema: { type: 'string' } },
                    { name: 'sort', in: 'query', schema: { type: 'string', enum: ['dataRegisto', 'mediaEstrelas', 'relevancia'] } },
                    { name: 'order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] } },
                    { name: 'limit', in: 'query', schema: { type: 'integer' } },
                    { name: 'page', in: 'query', schema: { type: 'integer' } }
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
        '/tipos-recurso': {
            get: {
                summary: 'Listar tipos de recurso ativos',
                responses: { '200': { description: 'Lista de tipos ativos' } }
            },
            post: {
                summary: 'Criar tipo de recurso',
                security: [{ bearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    nome: { type: 'string' },
                                    descricao: { type: 'string' },
                                    ordem: { type: 'integer' }
                                },
                                required: ['nome']
                            }
                        }
                    }
                },
                responses: {
                    '201': { description: 'Tipo criado' },
                    '401': { description: 'Nao autenticado' },
                    '403': { description: 'Sem permissao' },
                    '409': { description: 'Tipo ja existente' }
                }
            }
        },
        '/tipos-recurso/todos': {
            get: {
                summary: 'Listar todos os tipos de recurso',
                security: [{ bearerAuth: [] }],
                responses: {
                    '200': { description: 'Lista completa de tipos' },
                    '401': { description: 'Nao autenticado' },
                    '403': { description: 'Sem permissao' }
                }
            }
        },
        '/tipos-recurso/{id}': {
            put: {
                summary: 'Atualizar tipo de recurso',
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
                                    nome: { type: 'string' },
                                    descricao: { type: 'string' },
                                    ordem: { type: 'integer' },
                                    ativo: { type: 'boolean' }
                                }
                            }
                        }
                    }
                },
                responses: {
                    '200': { description: 'Tipo atualizado' },
                    '401': { description: 'Nao autenticado' },
                    '403': { description: 'Sem permissao' },
                    '404': { description: 'Tipo nao encontrado' }
                }
            }
        },
        '/disseminacao/recursos/{recursoId}/exportar': {
            get: {
                summary: 'Exportar DIP de um recurso',
                security: [{ bearerAuth: [] }],
                parameters: [
                    { name: 'recursoId', in: 'path', required: true, schema: { type: 'string' } }
                ],
                responses: {
                    '200': { description: 'DIP gerado com sucesso' },
                    '403': { description: 'Sem permissao' },
                    '404': { description: 'AIP ou recurso nao encontrado' }
                }
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

// Mount swagger UI and raw spec
function setupSwagger(app) {
    app.use('/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
    app.get('/docs.json', (req, res) => {
        res.json(swaggerSpec);
    });
}

module.exports = setupSwagger;
