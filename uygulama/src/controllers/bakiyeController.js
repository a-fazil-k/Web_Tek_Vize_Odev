const kullaniciRepository = require('../repositories/kullaniciRepository');
const bakiyeRepository = require('../repositories/bakiyeRepository');
const { handleDatabaseError } = require('../utils/dbErrors');

async function getBakiyeVeHareketler(req, res) {
  try {
    const taze = req.query.taze === '1';
    const bakiye = await kullaniciRepository.getBakiye(req.user.id, { taze });
    const hareketler = await bakiyeRepository.getHareketler(req.user.id, { taze });

    return res.json({
      bakiye,
      hareketler
    });
  } catch (err) {
    return handleDatabaseError(err, res);
  }
}

async function bakiyeYukle(req, res) {
  try {
    const { tutar } = req.body;
    const sayisalTutar = parseFloat(tutar);

    if (isNaN(sayisalTutar)) {
      return res.status(400).json({ hata: 'Geçersiz yükleme tutarı.' });
    }

    const sonuc = await bakiyeRepository.bakiyeYukle(req.user.id, sayisalTutar);
    if (!sonuc) {
      return res.status(400).json({ hata: 'Bakiye yükleme işlemi başarısız.' });
    }

    return res.json({
      mesaj: 'Bakiye başarıyla yüklendi.',
      hareket_id: sonuc.hareket_id,
      bakiye: sonuc.bakiye
    });
  } catch (err) {
    return handleDatabaseError(err, res);
  }
}

module.exports = {
  getBakiyeVeHareketler,
  bakiyeYukle
};
