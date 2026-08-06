const express = require('express');
const router = express.Router();
const { protectReader } = require('../middleware/auth');
const { heartbeat, getPointsProfile, getPointsHistory } = require('../controllers/points.controller');

router.post('/heartbeat', protectReader, heartbeat);
router.get('/me', protectReader, getPointsProfile);
router.get('/history', protectReader, getPointsHistory);

module.exports = router;
