const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');

// Category routes
router.get('/', categoryController.getAllCategories);
router.get('/type/:type', categoryController.getCategoriesByType);
router.get('/:id', categoryController.getCategoryById);
router.post('/', categoryController.createCategory);

module.exports = router;