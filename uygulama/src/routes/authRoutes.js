const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { oturumZorunlu } = require('../middlewares/auth');

router.post('/giris', authController.giris);
router.post('/cikis', authController.cikis);
router.get('/ben', oturumZorunlu, authController.ben);

module.exports = router;
