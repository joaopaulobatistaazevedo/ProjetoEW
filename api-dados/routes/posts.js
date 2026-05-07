const express = require('express');
const router = express.Router();
const postsController = require('../controllers/postsController');
// Auth guard for write operations
const { authenticate } = require('../middleware/auth');

// GET /posts — público
router.get('/', postsController.getAllPosts);

// POST /posts — autenticado
router.post('/', authenticate, postsController.createPost);

// GET /posts/:id — público
router.get('/:id', postsController.getPostById);

// PUT /posts/:id — autor ou admin
router.put('/:id', authenticate, postsController.updatePost);

// DELETE /posts/:id — autor ou admin
router.delete('/:id', authenticate, postsController.deletePost);

// POST /posts/:id/comentarios — autenticado
router.post('/:id/comentarios', authenticate, postsController.createComentario);

// DELETE /posts/:id/comentarios/:cid — autor do comentário ou admin
router.delete('/:id/comentarios/:cid', authenticate, postsController.deleteComentario);

module.exports = router;