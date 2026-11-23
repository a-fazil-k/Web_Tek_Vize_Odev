const degerlendirmeRepository = require('../repositories/degerlendirmeRepository');
const { handleDatabaseError } = require('../utils/dbErrors');

async function degerlendirmeYap(req, res) {
  try {
    const { menu_id, puan, yorum } = req.body;

    if (!menu_id) {
      return res.status(400).json({ hata: 'Menü ID zorunludur.' });
    }

    const sayisalPuan = parseInt(puan, 10);
    if (isNaN(sayisalPuan) || sayisalPuan < 1 || sayisalPuan > 5) {
      return res.status(400).json({ hata: 'Puan 1 ile 5 arasında bir tam sayı olmalıdır.' });
    }

    // İş Kuralı: Yalnızca kullanılmış rezervasyonu olan menü değerlendirilebilir
    const kullanildi = await degerlendirmeRepository.hasKullanilmisRezervasyon(req.user.id, menu_id);
    if (!kullanildi) {
      return res.status(400).json({ hata: 'Yalnızca kullandığınız menüleri değerlendirebilirsiniz.' });
    }

    // İş Kuralı: Kişi başına menü başına tek oy
    const mevcut = await degerlendirmeRepository.findByKullaniciAndMenu(req.user.id, menu_id);
    if (mevcut) {
      return res.status(400).json({ hata: 'Bu menüyü daha önce değerlendirdiniz.' });
    }

    const id = await degerlendirmeRepository.createDegerlendirme(
      req.user.id,
      menu_id,
      sayisalPuan,
      yorum ? String(yorum).trim() : null
    );

    return res.status(201).json({
      mesaj: 'Değerlendirmeniz başarıyla kaydedildi.',
      degerlendirme_id: id
    });
  } catch (err) {
    return handleDatabaseError(err, res);
  }
}

async function getMenuDegerlendirmeleri(req, res) {
  try {
    const menuId = parseInt(req.params.menu_id, 10);
    if (isNaN(menuId)) {
      return res.status(400).json({ hata: 'Geçersiz menü ID.' });
    }

    const degerlendirmeler = await degerlendirmeRepository.getByMenuId(menuId);
    return res.json(degerlendirmeler);
  } catch (err) {
    return handleDatabaseError(err, res);
  }
}

module.exports = {
  degerlendirmeYap,
  getMenuDegerlendirmeleri
};
