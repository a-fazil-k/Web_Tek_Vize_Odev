const express = require('express');
const router = express.Router();
const profilController = require('../controllers/profilController');
const { oturumZorunlu } = require('../middlewares/auth');

// Profil bilgileri
router.get('/', oturumZorunlu, profilController.getProfil);

// Kullanıcı alerjen tercihleri
router.get('/alerjenler', oturumZorunlu, profilController.getProfilAlerjenler);
router.put('/alerjenler', oturumZorunlu, profilController.updateProfilAlerjenler);

module.exports = router;
