const express = require('express');
const router = express.Router();
const degerlendirmeController = require('../controllers/degerlendirmeController');
const { oturumZorunlu, oturumOpsiyonel } = require('../middlewares/auth');

router.post('/', oturumZorunlu, degerlendirmeController.degerlendirmeYap);
router.get('/menu/:menu_id', oturumOpsiyonel, degerlendirmeController.getMenuDegerlendirmeleri);

module.exports = router;
