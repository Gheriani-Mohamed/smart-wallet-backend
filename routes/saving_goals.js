// routes/saving_goals.js
const express = require('express');
const router = express.Router();
const savingGoalsController = require('../controllers/savinggoalsContoller');
const authMiddleware = require('../middleware/auth');

// Appliquer le middleware à toutes les routes
router.use(authMiddleware);

// Routes
router.get('/', savingGoalsController.getMyGoals);
router.post('/', savingGoalsController.createGoal);
router.post('/:id/contribute', savingGoalsController.contributeToGoal);
router.delete('/:id', savingGoalsController.deleteGoal);

module.exports = router;