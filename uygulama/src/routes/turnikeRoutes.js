const express = require('express');
const router = express.Router();
const turnikeController = require('../controllers/turnikeController');
const { oturumOpsiyonel } = require('../middlewares/auth');

router.post('/gecis', oturumOpsiyonel, turnikeController.gecis);

module.exports = router;
