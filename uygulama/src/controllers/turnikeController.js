const turnikeRepository = require('../repositories/turnikeRepository');
const { handleDatabaseError } = require('../utils/dbErrors');

async function gecis(req, res) {
  try {
    const kullaniciId = req.body.kullanici_id || req.user?.id;
    const { yemekhane_id, zaman } = req.body;

    if (!kullaniciId) {
      return res.status(400).json({ hata: 'Kullanıcı ID zorunludur.' });
    }
    if (!yemekhane_id) {
      return res.status(400).json({ hata: 'Yemekhane ID zorunludur.' });
    }

    const sonuc = await turnikeRepository.turnikeGecis(
      parseInt(kullaniciId, 10),
      parseInt(yemekhane_id, 10),
      zaman || null
    );

    return res.json({
      mesaj: 'Turnike geçişi onaylandı.',
      rezervasyon_id: sonuc.rezervasyon_id,
      menu_id: sonuc.menu_id,
      ogun: sonuc.ogun
    });
  } catch (err) {
    return handleDatabaseError(err, res);
  }
}

module.exports = {
  gecis
};
