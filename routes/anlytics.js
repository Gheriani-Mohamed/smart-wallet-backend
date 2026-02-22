const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analyticsController');

// Analytics endpoints
router.get('/category', analyticsController.getSpendingByCategory);
router.get('/income-expense', analyticsController.getIncomeVsExpense);
router.get('/summary', analyticsController.getSummary);

module.exports = router;