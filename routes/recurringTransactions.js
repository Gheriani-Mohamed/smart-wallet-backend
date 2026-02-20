const express = require('express');
const router = express.Router();
const recurringTransactionController = require('../controllers/recurringTransactionController');

// Recurring Transaction CRUD
router.post('/', recurringTransactionController.createRecurringTransaction);
router.get('/user/:userId', recurringTransactionController.getUserRecurringTransactions);
router.get('/wallet/:walletId', recurringTransactionController.getWalletRecurringTransactions);
router.get('/:id', recurringTransactionController.getRecurringTransactionById);
router.put('/:id', recurringTransactionController.updateRecurringTransaction);
router.delete('/:id', recurringTransactionController.deleteRecurringTransaction);

// Auto-generation
router.post('/:id/generate', recurringTransactionController.generateTransactions);
router.post('/user/:userId/generate-all', recurringTransactionController.generateAllUserTransactions);

module.exports = router;