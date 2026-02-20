const express = require('express');
const router = express.Router();
const alertController = require('../controllers/alertController');

// Alert CRUD
router.post('/', alertController.createAlert);
router.get('/user/:userId', alertController.getUserAlerts);
router.get('/user/:userId/unread', alertController.getUnreadAlerts);
router.get('/user/:userId/count', alertController.getUnreadCount);
router.get('/:id', alertController.getAlertById);
router.put('/:id/read', alertController.markAsRead);
router.put('/user/:userId/read-all', alertController.markAllAsRead);
router.delete('/:id', alertController.deleteAlert);
router.delete('/user/:userId/all', alertController.deleteAllAlerts);

module.exports = router;