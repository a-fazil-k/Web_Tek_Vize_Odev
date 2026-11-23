const express = require('express');
const router = express.Router();
const bakiyeController = require('../controllers/bakiyeController');
const { oturumZorunlu } = require('../middlewares/auth');

router.use(oturumZorunlu);

router.get('/', bakiyeController.getBakiyeVeHareketler);
router.post('/yukle', bakiyeController.bakiyeYukle);

module.exports = router;
