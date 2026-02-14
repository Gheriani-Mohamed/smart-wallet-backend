const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const alertController = require('../controllers/alertController');

// All routes require authentication
router.use(authMiddleware);

// Alert routes
router.get('/user/:userId', alertController.getUserAlerts);
router.get('/unread/:userId', alertController.getUnreadAlerts);
router.get('/count/:userId', alertController.getUnreadCount);
router.put('/:id/read', alertController.markAsRead);
router.put('/read-all/:userId', alertController.markAllAsRead);
router.delete('/:id', alertController.deleteAlert);
router.delete('/clear-read/:userId', alertController.clearReadAlerts);

module.exports = router;