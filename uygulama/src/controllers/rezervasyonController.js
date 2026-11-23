const rezervasyonRepository = require('../repositories/rezervasyonRepository');
const { handleDatabaseError } = require('../utils/dbErrors');

async function getRezervasyonlar(req, res) {
  try {
    const rezervasyonlar = await rezervasyonRepository.getByKullaniciId(req.user.id);
    return res.json(rezervasyonlar);
  } catch (err) {
    return handleDatabaseError(err, res);
  }
}

async function rezervasyonYap(req, res) {
  try {
    const { menu_id, porsiyon } = req.body;
    if (!menu_id) {
      return res.status(400).json({ hata: 'Menü ID belirtilmelidir.' });
    }

    const seciliPorsiyon = (porsiyon && String(porsiyon).trim().toLowerCase()) || 'tam';

    const sonuc = await rezervasyonRepository.rezervasyonYap(
      req.user.id,
      menu_id,
      seciliPorsiyon
    );
    if (!sonuc) {
      return res.status(400).json({ hata: 'Rezervasyon oluşturulamadı.' });
    }

    return res.status(201).json({
      mesaj: 'Rezervasyon başarıyla oluşturuldu.',
      rezervasyon_id: sonuc.rezervasyon_id,
      ucret: sonuc.ucret,
      bakiye: sonuc.bakiye,
      porsiyon: sonuc.porsiyon || seciliPorsiyon
    });
  } catch (err) {
    return handleDatabaseError(err, res);
  }
}

async function rezervasyonIptal(req, res) {
  try {
    const rezervasyonId = parseInt(req.params.id, 10);
    if (isNaN(rezervasyonId)) {
      return res.status(400).json({ hata: 'Geçersiz rezervasyon ID.' });
    }

    const sonuc = await rezervasyonRepository.rezervasyonIptal(req.user.id, rezervasyonId);
    if (!sonuc) {
      return res.status(400).json({ hata: 'Rezervasyon iptal edilemedi.' });
    }

    return res.json({
      mesaj: 'Rezervasyon başarıyla iptal edildi.',
      rezervasyon_id: sonuc.rezervasyon_id,
      iade: sonuc.iade,
      bakiye: sonuc.bakiye
    });
  } catch (err) {
    return handleDatabaseError(err, res);
  }
}

module.exports = {
  getRezervasyonlar,
  rezervasyonYap,
  rezervasyonIptal
};
