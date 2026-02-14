//** The Setup Route to create basic data **/


const express = require('express');
const router = express.Router();
const setupController = require('../controllers/setupController');

// Setup test data
router.post('/create', setupController.setupTestData);

// Clear test data
router.delete('/clear', setupController.clearTestData);

module.exports = router;