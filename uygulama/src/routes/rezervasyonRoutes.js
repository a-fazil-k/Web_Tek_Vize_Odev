const express = require('express');
const router = express.Router();
const rezervasyonController = require('../controllers/rezervasyonController');
const { oturumZorunlu } = require('../middlewares/auth');

router.use(oturumZorunlu);

router.get('/', rezervasyonController.getRezervasyonlar);
router.post('/', rezervasyonController.rezervasyonYap);
router.delete('/:id', rezervasyonController.rezervasyonIptal);

module.exports = router;
