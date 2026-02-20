const express = require('express');
const router = express.Router();
const transactionController = require('../controllers/transactionsController');

// Transaction CRUD
router.post('/', transactionController.createTransaction);
router.get('/user/:userId', transactionController.getUserTransactions);
router.get('/wallet/:walletId', transactionController.getWalletTransactions);
router.get('/wallet/:walletId/category/:categoryId', transactionController.getTransactionsByCategory);
router.get('/wallet/:walletId/type/:type', transactionController.getTransactionsByType);
router.get('/wallet/:walletId/range', transactionController.getTransactionsByDateRange);
router.get('/wallet/:walletId/stats', transactionController.getWalletStats);
router.get('/:id', transactionController.getTransactionById);
router.put('/:id', transactionController.updateTransaction);
router.delete('/:id', transactionController.deleteTransaction);

module.exports = router;