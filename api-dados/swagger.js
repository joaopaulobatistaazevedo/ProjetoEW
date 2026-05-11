const swaggerUi = require('swagger-ui-express');

const PORT = process.env.PORT || 3001;
const SWAGGER_URL = process.env.SWAGGER_URL || `http://localhost:${PORT}`;

const jsonBody = {
    required: true,
    content: {
        'application/json': {
            schema: { type: 'object' }
        }
    }
};

const idParam = { name: 'id', in: 'path', required: true, schema: { type: 'string' } };

const swaggerSpec = {
    openapi: '3.0.3',
    info: {
        title: 'API de Dados - Recursos Educativos',
        version: '1.0.0',
        description: 'Endpoints do servico api-dados: recursos, tipos, ingestao AIP/SIP, disseminacao DIP, posts e noticias.'
    },
    servers: [{ url: SWAGGER_URL, description: 'Servidor local' }],
    components: {
        securitySchemes: {
            bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
        }
    },
    paths: {
        '/recursos': {
            get: {
                summary: 'Listar recursos',
                parameters: [
                    { name: 'q', in: 'query', schema: { type: 'string' } },
                    { name: 'tipo', in: 'query', schema: { type: 'string' } },
                    { name: 'hashtag', in: 'query', schema: { type: 'string' } },
                    { name: 'ano', in: 'query', schema: { type: 'string' } },
                    { name: 'visibilidade', in: 'query', schema: { type: 'string', enum: ['publico', 'privado'] } },
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
                summary: 'Criar recurso sem ficheiros',
                description: 'Recursos com ficheiros devem ser submetidos por /ingestao/sip ou /ingestao/form.',
                security: [{ bearerAuth: [] }],
                requestBody: jsonBody,
                responses: { '201': { description: 'Recurso criado' }, '403': { description: 'Ficheiros rejeitados nesta rota' } }
            }
        },
        '/recursos/top3': {
            get: { summary: 'Top 3 recursos', responses: { '200': { description: 'Top 3 por media de estrelas' } } }
        },
        '/recursos/{id}': {
            get: { summary: 'Detalhe de recurso', parameters: [idParam], responses: { '200': { description: 'Detalhe do recurso' }, '404': { description: 'Nao encontrado' } } },
            put: {
                summary: 'Editar recurso',
                description: 'Aceita JSON ou multipart/form-data com ficheirosNovos e ficheirosRemover. A edicao cria nova versao AIP.',
                security: [{ bearerAuth: [] }],
                parameters: [idParam],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': { schema: { type: 'object' } },
                        'multipart/form-data': {
                            schema: {
                                type: 'object',
                                properties: {
                                    titulo: { type: 'string' },
                                    subtitulo: { type: 'string' },
                                    descricao: { type: 'string' },
                                    tipo: { type: 'string' },
                                    dataCriacao: { type: 'string', format: 'date' },
                                    visibilidade: { type: 'string', enum: ['publico', 'privado'] },
                                    hashtags: { type: 'string' },
                                    ficheirosRemover: { type: 'array', items: { type: 'string' } },
                                    ficheirosNovos: { type: 'array', items: { type: 'string', format: 'binary' } }
                                }
                            }
                        }
                    }
                },
                responses: { '200': { description: 'Recurso atualizado e AIP versionado' }, '403': { description: 'Sem permissao' } }
            },
            delete: { summary: 'Apagar recurso', security: [{ bearerAuth: [] }], parameters: [idParam], responses: { '200': { description: 'Removido' } } }
        },
        '/recursos/{id}/download': {
            get: { summary: 'Download ZIP do recurso', security: [{ bearerAuth: [] }], parameters: [idParam], responses: { '200': { description: 'ZIP enviado' } } }
        },
        '/recursos/{id}/preview': {
            get: { summary: 'Metadados dos ficheiros do recurso', parameters: [idParam], responses: { '200': { description: 'Lista de ficheiros' } } }
        },
        '/recursos/{id}/rate': {
            patch: {
                summary: 'Avaliar recurso',
                security: [{ bearerAuth: [] }],
                parameters: [idParam],
                requestBody: {
                    required: true,
                    content: { 'application/json': { schema: { type: 'object', properties: { estrelas: { type: 'integer', minimum: 1, maximum: 5 } }, required: ['estrelas'] } } }
                },
                responses: { '200': { description: 'Avaliacao registada' } }
            }
        },
        '/tipos-recurso': {
            get: { summary: 'Listar tipos ativos', responses: { '200': { description: 'Lista de tipos ativos' } } },
            post: { summary: 'Criar tipo', security: [{ bearerAuth: [] }], requestBody: jsonBody, responses: { '201': { description: 'Tipo criado' }, '403': { description: 'Apenas admin' } } }
        },
        '/tipos-recurso/todos': {
            get: { summary: 'Listar todos os tipos', security: [{ bearerAuth: [] }], responses: { '200': { description: 'Lista completa de tipos' }, '403': { description: 'Apenas admin' } } }
        },
        '/tipos-recurso/{id}': {
            put: { summary: 'Atualizar tipo', security: [{ bearerAuth: [] }], parameters: [idParam], requestBody: jsonBody, responses: { '200': { description: 'Tipo atualizado' } } }
        },
        '/ingestao/sip': {
            post: {
                summary: 'Submeter SIP em ZIP',
                security: [{ bearerAuth: [] }],
                requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: { file: { type: 'string', format: 'binary' } }, required: ['file'] } } } },
                responses: { '201': { description: 'SIP validado e AIP criado' }, '400': { description: 'SIP rejeitado' } }
            }
        },
        '/ingestao/form': {
            post: {
                summary: 'Submeter recurso por formulario e gerar SIP',
                security: [{ bearerAuth: [] }],
                requestBody: { required: true, content: { 'multipart/form-data': { schema: { type: 'object', properties: { titulo: { type: 'string' }, descricao: { type: 'string' }, tipo: { type: 'string' }, ficheiros: { type: 'array', items: { type: 'string', format: 'binary' } } }, required: ['titulo', 'tipo', 'ficheiros'] } } } },
                responses: { '201': { description: 'Recurso e AIP criados' } }
            }
        },
        '/ingestao/aips': {
            get: { summary: 'Listar AIPs', description: 'Admin ve todos; outros utilizadores veem os seus.', security: [{ bearerAuth: [] }], parameters: [{ name: 'page', in: 'query', schema: { type: 'integer' } }, { name: 'limit', in: 'query', schema: { type: 'integer' } }, { name: 'status', in: 'query', schema: { type: 'string', enum: ['ok', 'erro'] } }], responses: { '200': { description: 'Lista paginada de AIPs' } } }
        },
        '/ingestao/aips/{sipId}': {
            get: { summary: 'Detalhe de AIP', security: [{ bearerAuth: [] }], parameters: [{ name: 'sipId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'AIP encontrado' } } }
        },
        '/ingestao/aips/{sipId}/relatorio': {
            get: { summary: 'Relatorio de validacao do AIP', security: [{ bearerAuth: [] }], parameters: [{ name: 'sipId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Relatorio do AIP' } } }
        },
        '/ingestao/recursos/{recursoId}/historico-aip': {
            get: { summary: 'Historico de versoes AIP de um recurso', security: [{ bearerAuth: [] }], parameters: [{ name: 'recursoId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Historico AIP' } } }
        },
        '/disseminacao/recursos/{recursoId}/exportar': {
            get: { summary: 'Exportar DIP completo de um recurso', security: [{ bearerAuth: [] }], parameters: [{ name: 'recursoId', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'ZIP DIP' } } }
        },
        '/disseminacao/recursos/exportar-multiplos': {
            get: { summary: 'Exportar varios DIPs num ZIP', security: [{ bearerAuth: [] }], parameters: [{ name: 'ids', in: 'query', required: true, schema: { type: 'string' }, description: 'IDs separados por virgula.' }], responses: { '200': { description: 'ZIP com varios recursos' } } }
        },
        '/disseminacao/recursos/{recursoId}/historico-exportacoes': {
            get: { summary: 'Historico de exportacoes DIP', security: [{ bearerAuth: [] }], parameters: [{ name: 'recursoId', in: 'path', required: true, schema: { type: 'string' } }, { name: 'page', in: 'query', schema: { type: 'integer' } }, { name: 'limit', in: 'query', schema: { type: 'integer' } }], responses: { '200': { description: 'Historico de exportacoes' } } }
        },
        '/disseminacao/meus-recursos/exportar-todos': {
            get: { summary: 'Exportar todos os recursos do utilizador autenticado', security: [{ bearerAuth: [] }], responses: { '200': { description: 'ZIP com os recursos do utilizador' } } }
        },
        '/disseminacao/recursos/{recursoId}/ficheiros/{indice}/exportar': {
            get: { summary: 'Exportar ficheiro individual preservado no AIP', security: [{ bearerAuth: [] }], parameters: [{ name: 'recursoId', in: 'path', required: true, schema: { type: 'string' } }, { name: 'indice', in: 'path', required: true, schema: { type: 'integer' } }], responses: { '200': { description: 'Ficheiro individual' } } }
        },
        '/posts': {
            get: { summary: 'Listar posts', parameters: [{ name: 'recurso', in: 'query', schema: { type: 'string' } }], responses: { '200': { description: 'Lista de posts' } } },
            post: { summary: 'Criar post', security: [{ bearerAuth: [] }], requestBody: jsonBody, responses: { '201': { description: 'Post criado' } } }
        },
        '/posts/{id}': {
            get: { summary: 'Detalhe de post', parameters: [idParam], responses: { '200': { description: 'Post' } } },
            put: { summary: 'Editar post', security: [{ bearerAuth: [] }], parameters: [idParam], requestBody: jsonBody, responses: { '200': { description: 'Post atualizado' } } },
            delete: { summary: 'Apagar post', security: [{ bearerAuth: [] }], parameters: [idParam], responses: { '200': { description: 'Post removido' } } }
        },
        '/posts/{id}/comentarios': {
            post: { summary: 'Adicionar comentario', security: [{ bearerAuth: [] }], parameters: [idParam], requestBody: jsonBody, responses: { '201': { description: 'Comentario criado' } } }
        },
        '/posts/{id}/comentarios/{cid}': {
            delete: { summary: 'Remover comentario', security: [{ bearerAuth: [] }], parameters: [idParam, { name: 'cid', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Comentario removido' } } }
        },
        '/noticias': {
            get: { summary: 'Listar noticias e atualizar noticias automaticas', parameters: [{ name: 'dias', in: 'query', schema: { type: 'integer' } }], responses: { '200': { description: 'Lista de noticias' } } },
            post: { summary: 'Criar noticia admin', security: [{ bearerAuth: [] }], requestBody: jsonBody, responses: { '201': { description: 'Noticia criada' } } }
        },
        '/noticias/latest': {
            get: { summary: 'Listar noticias recentes', parameters: [{ name: 'dias', in: 'query', required: true, schema: { type: 'integer' } }, { name: 'limit', in: 'query', schema: { type: 'integer' } }], responses: { '200': { description: 'Noticias recentes' } } }
        },
        '/noticias/internal': {
            post: { summary: 'Criar noticia interna', description: 'Requer header x-internal-news-secret.', requestBody: jsonBody, responses: { '201': { description: 'Noticia criada' }, '403': { description: 'Segredo interno invalido' } } }
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
