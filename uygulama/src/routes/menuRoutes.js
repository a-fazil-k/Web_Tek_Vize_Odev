const express = require('express');
const router = express.Router();
const menuController = require('../controllers/menuController');
const { oturumOpsiyonel } = require('../middlewares/auth');

router.get('/gunluk', oturumOpsiyonel, menuController.getGunlukMenuler);
router.get('/haftalik', oturumOpsiyonel, menuController.getHaftalikMenuler);

module.exports = router;
