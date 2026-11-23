const alerjenRepository = require('../repositories/alerjenRepository');
const kullaniciRepository = require('../repositories/kullaniciRepository');

// Tüm alerjenleri listeler (GET /api/alerjenler)
async function getAlerjenler(req, res) {
  try {
    const alerjenler = await alerjenRepository.getAllAlerjenler();
    return res.json(alerjenler);
  } catch (err) {
    console.error('Alerjenler getirme hatası:', err);
    return res.status(500).json({ hata: 'Alerjenler listelenemedi.' });
  }
}

// Oturum açmış kullanıcının alerjen tercihlerini getirir (GET /api/profil/alerjenler)
async function getProfilAlerjenler(req, res) {
  try {
    const alerjenler = await alerjenRepository.getKullaniciAlerjenleri(req.user.id);
    return res.json({
      kullanici_id: req.user.id,
      alerjenler,
      alerjen_ids: alerjenler.map(a => a.id)
    });
  } catch (err) {
    console.error('Kullanıcı alerjenleri getirme hatası:', err);
    return res.status(500).json({ hata: 'Kullanıcı alerjenleri getirilemedi.' });
  }
}

// Oturum açmış kullanıcının alerjen tercihlerini günceller (PUT /api/profil/alerjenler)
async function updateProfilAlerjenler(req, res) {
  try {
    const { alerjen_ids } = req.body;
    if (alerjen_ids !== undefined && !Array.isArray(alerjen_ids)) {
      return res.status(400).json({ hata: 'Alerjen ID listesi dizi (array) formatında olmalıdır.' });
    }

    const ids = Array.isArray(alerjen_ids) ? alerjen_ids : [];
    const guncel = await alerjenRepository.setKullaniciAlerjenleri(req.user.id, ids);

    return res.json({
      mesaj: 'Alerjen tercihleriniz başarıyla güncellendi.',
      alerjenler: guncel,
      alerjen_ids: guncel.map(a => a.id)
    });
  } catch (err) {
    console.error('Kullanıcı alerjen güncelleme hatası:', err);
    return res.status(500).json({ hata: 'Alerjen tercihleri kaydedilemedi.' });
  }
}

// Kullanıcı profil bilgilerini getirir (GET /api/profil)
async function getProfil(req, res) {
  try {
    const kullanici = await kullaniciRepository.findById(req.user.id, { taze: true });
    if (!kullanici) {
      return res.status(404).json({ hata: 'Kullanıcı bulunamadı.' });
    }
    const alerjenler = await alerjenRepository.getKullaniciAlerjenleri(req.user.id);
    return res.json({
      ...kullanici,
      alerjenler,
      alerjen_ids: alerjenler.map(a => a.id)
    });
  } catch (err) {
    console.error('Profil getirme hatası:', err);
    return res.status(500).json({ hata: 'Profil bilgileri getirilemedi.' });
  }
}

module.exports = {
  getAlerjenler,
  getProfilAlerjenler,
  updateProfilAlerjenler,
  getProfil
};
