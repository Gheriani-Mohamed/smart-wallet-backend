const express = require('express');
const router = express.Router();
const walletController = require('../controllers/walletsController');
const  transferMoney  = require('../controllers/walletTransferController');


// Wallet CRUD
router.post('/', walletController.createWallet);
router.post('/transfer',  transferMoney.transferMoney);
router.get('/user/:userId', walletController.getUserWallets);
router.get('/user/:userId/shared', walletController.getSharedWallets);
router.get('/user/:userId/personal', walletController.getPersonalWallets);
router.get('/:id', walletController.getWalletById);
router.put('/:id', walletController.updateWallet);
router.put('/:id/balance', walletController.updateWalletBalance);
router.delete('/:id', walletController.deleteWallet);

// Member Management
router.post('/:walletId/members', walletController.addMember);
router.delete('/:walletId/members/:userId', walletController.removeMember);
router.get('/:walletId/members', walletController.getWalletMembers);
router.get('/:walletId/access/:userId', walletController.checkAccess);

module.exports = router;