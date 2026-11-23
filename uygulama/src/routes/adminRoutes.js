const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { oturumZorunlu, rolGerektir } = require('../middlewares/auth');

router.use(oturumZorunlu, rolGerektir('yonetici'));

router.get('/yemekler', adminController.getAdminYemekler);
router.get('/menuler', adminController.getAdminMenuler);
router.post('/menuler', adminController.createAdminMenu);
router.put('/menuler/:id', adminController.updateAdminMenu);

module.exports = router;
