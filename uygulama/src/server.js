const express = require('express');
const cookieParser = require('cookie-parser');
const apiRoutes = require('./routes/index');

const app = express();
const PORT = process.env.PORT || 8000;

// Temel middleware'ler
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// İstek loglama (basit geliştirme günlüğü)
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Tüm API rotaları /api önekiyle bağlanır
app.use('/api', apiRoutes);

// Tanımsız route'lar için 404
app.use((req, res) => {
  res.status(404).json({ hata: 'İstenen API endpoint bulunamadı.' });
});

// Genel hata yakalayıcı
app.use((err, req, res, next) => {
  console.error('Sunucu Hatası:', err);
  res.status(500).json({ hata: 'Beklenmeyen bir sunucu hatası oluştu.' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Yemekhane API servisi ${PORT} portunda çalışıyor.`);
});
