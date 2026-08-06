const express = require('express');
const router = express.Router();
const { protectReader } = require('../middleware/auth');
const {
  initiateCardPayment,
  initiateWalletPayment,
  paymobWebhook,
  getMyLatestOrderStatus
} = require('../controllers/payment.controller');

router.post('/gold/card', protectReader, initiateCardPayment);
router.post('/gold/wallet', protectReader, initiateWalletPayment);
router.get('/gold/status', protectReader, getMyLatestOrderStatus);

// عام - Paymob هو اللي بينادي على المسار ده مباشرة (مش المتصفح)
router.post('/webhook', paymobWebhook);

module.exports = router;
