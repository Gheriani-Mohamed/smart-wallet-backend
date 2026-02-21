const express = require('express');
const router = express.Router();
const savingGoalsController = require('../controllers/savinggoalsContoller');

// Saving Goal CRUD
router.post('/', savingGoalsController.createSavingGoal);
router.get('/user/:userId', savingGoalsController.getUserSavingGoals);
router.get('/wallet/:walletId', savingGoalsController.getWalletSavingGoals);
router.get('/:id', savingGoalsController.getSavingGoalById);
router.put('/:id', savingGoalsController.updateSavingGoal);
router.delete('/:id', savingGoalsController.deleteSavingGoal);

// Contributions
router.post('/:id/contribute', savingGoalsController.addContribution);
router.post('/:id/withdraw', savingGoalsController.withdrawFromGoal);

module.exports = router;