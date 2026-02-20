const express = require('express');
const router = express.Router();
const budgetController = require('../controllers/budgetController');

// Budget CRUD
router.post('/', budgetController.createBudget);
router.get('/user/:userId', budgetController.getUserBudgets);
router.get('/wallet/:walletId', budgetController.getWalletBudgets);
router.get('/wallet/:walletId/month/:month', budgetController.getWalletMonthlyBudgets); // NEW - Get budgets for wallet in specific month
router.get('/month/:userId/:month', budgetController.getMonthlyBudgets);
router.get('/:id', budgetController.getBudgetById);
router.put('/:id', budgetController.updateBudget);
router.delete('/:id', budgetController.deleteBudget);

// Budget operations
router.post('/:id/update-spent', budgetController.updateBudgetSpent);
router.post('/:id/reset', budgetController.resetBudget);
router.post('/:id/check-threshold', budgetController.checkThreshold);
router.post('/sync/:budgetId', budgetController.syncWithTransactions);
router.post('/sync-all/:userId', budgetController.syncAllBudgets);

module.exports = router;