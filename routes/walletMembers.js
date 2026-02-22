const express = require('express');
const router = express.Router();
const walletMembersController = require('../controllers/walletMembersController');

// Add member to wallet
router.post('/:walletId/members', walletMembersController.addMember);
// Get members of a wallet
router.get('/:walletId/members', walletMembersController.getMembers);
router.delete('/:walletId/members/:userId', walletMembersController.removeMember);

module.exports = router;