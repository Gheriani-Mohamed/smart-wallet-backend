const express = require('express');
const router = express.Router();
const walletsController = require('../controllers/walletsController');


// Get all wallets
router.get('/', walletsController.getWallets);

// Create wallet
router.post('/', walletsController.createWallet);

// Update wallet balance
router.put('/:id', walletsController.updateWalletBalance);

// Delete wallet
router.delete('/:id', walletsController.deleteWallet);





module.exports = router;
