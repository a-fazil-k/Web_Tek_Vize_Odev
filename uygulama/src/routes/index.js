const express = require('express');
const router = express.Router();

const authRoutes = require('./authRoutes');
const menuRoutes = require('./menuRoutes');
const rezervasyonRoutes = require('./rezervasyonRoutes');
const bakiyeRoutes = require('./bakiyeRoutes');
const degerlendirmeRoutes = require('./degerlendirmeRoutes');
const adminRoutes = require('./adminRoutes');
const turnikeRoutes = require('./turnikeRoutes');

const menuController = require('../controllers/menuController');

// Sağlık ve kök kontrol endpoint'i
router.get('/', (req, res) => {
  res.json({ durum: 'calisiyor', servis: 'Yemekhane Web API' });
});

// Route modülleri
router.use('/auth', authRoutes);
router.get('/yemekhaneler', menuController.getYemekhaneler);
router.get('/ogunler', menuController.getOgunler);
router.use('/menuler', menuRoutes);
router.use('/rezervasyonlar', rezervasyonRoutes);
router.use('/bakiye', bakiyeRoutes);
router.use('/degerlendirmeler', degerlendirmeRoutes);
router.use('/admin', adminRoutes);
router.use('/turnike', turnikeRoutes);

module.exports = router;
