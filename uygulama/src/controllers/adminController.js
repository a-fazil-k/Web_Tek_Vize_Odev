const menuRepository = require('../repositories/menuRepository');
const { handleDatabaseError } = require('../utils/dbErrors');
const { menuCacheInvalidate } = require('../services/menuCacheService');

async function getAdminYemekler(req, res) {
  try {
    const yemekler = await menuRepository.getAdminYemekler();
    return res.json(yemekler);
  } catch (err) {
    return handleDatabaseError(err, res);
  }
}

async function getAdminMenuler(req, res) {
  try {
    const { baslangic, bitis, yemekhane_id } = req.query;
    const menuler = await menuRepository.getAdminMenuler({
      baslangic,
      bitis,
      yemekhane_id: yemekhane_id ? parseInt(yemekhane_id, 10) : null
    });

    // Menülerin yemeklerini de ekleyelim
    const menuIds = menuler.map(m => m.menu_id);
    const yemekRows = await menuRepository.getMenuYemekleri(menuIds);

    const yemekMap = new Map();
    for (const y of yemekRows) {
      if (!yemekMap.has(y.menu_id)) {
        yemekMap.set(y.menu_id, []);
      }
      yemekMap.get(y.menu_id).push({
        id: y.yemek_id,
        ad: y.yemek,
        kalori: y.kalori,
        vejetaryen: Boolean(y.vejetaryen),
        kategori_id: y.kategori_id,
        kategori: y.kategori,
        kategori_sira: y.kategori_sira
      });
    }

    const sonuc = menuler.map(m => {
      const menununYemekleri = yemekMap.get(m.menu_id) || [];
      const toplamKalori = menununYemekleri.reduce((sum, y) => sum + (y.kalori || 0), 0);
      return {
        ...m,
        toplam_kalori: toplamKalori,
        yemekler: menununYemekleri
      };
    });

    return res.json(sonuc);
  } catch (err) {
    return handleDatabaseError(err, res);
  }
}

async function createAdminMenu(req, res) {
  try {
    const { yemekhane_id, tarih, ogun_id, ogrenci_fiyati, personel_fiyati, yemek_ids } = req.body;

    if (!yemekhane_id || !tarih || !ogun_id || ogrenci_fiyati === undefined || personel_fiyati === undefined) {
      return res.status(400).json({ hata: 'Yemekhane, tarih, öğün, öğrenci fiyatı ve personel fiyatı zorunludur.' });
    }

    if (parseFloat(ogrenci_fiyati) < 0 || parseFloat(personel_fiyati) < 0) {
      return res.status(400).json({ hata: 'Fiyatlar 0 veya daha büyük olmalıdır.' });
    }

    const menuId = await menuRepository.createMenu({
      yemekhane_id: parseInt(yemekhane_id, 10),
      tarih,
      ogun_id: parseInt(ogun_id, 10),
      ogrenci_fiyati: parseFloat(ogrenci_fiyati),
      personel_fiyati: parseFloat(personel_fiyati),
      yemek_ids: Array.isArray(yemek_ids) ? yemek_ids.map(id => parseInt(id, 10)) : []
    });

    // Redis önbelleğini geçersizleştir (invalidation)
    await menuCacheInvalidate(yemekhane_id, tarih, ogun_id);

    return res.status(201).json({
      mesaj: 'Menü başarıyla oluşturuldu.',
      menu_id: menuId
    });
  } catch (err) {
    return handleDatabaseError(err, res);
  }
}

async function updateAdminMenu(req, res) {
  try {
    const menuId = parseInt(req.params.id, 10);
    if (isNaN(menuId)) {
      return res.status(400).json({ hata: 'Geçersiz menü ID.' });
    }

    // Güncelleme öncesi eski menü bilgilerini al
    const eskiMenu = await menuRepository.findMenuBaslikById(menuId);

    const { yemekhane_id, tarih, ogun_id, ogrenci_fiyati, personel_fiyati, yemek_ids } = req.body;

    if (ogrenci_fiyati !== undefined && parseFloat(ogrenci_fiyati) < 0) {
      return res.status(400).json({ hata: 'Öğrenci fiyatı 0 veya daha büyük olmalıdır.' });
    }
    if (personel_fiyati !== undefined && parseFloat(personel_fiyati) < 0) {
      return res.status(400).json({ hata: 'Personel fiyatı 0 veya daha büyük olmalıdır.' });
    }

    await menuRepository.updateMenu(menuId, {
      yemekhane_id: yemekhane_id !== undefined ? parseInt(yemekhane_id, 10) : undefined,
      tarih,
      ogun_id: ogun_id !== undefined ? parseInt(ogun_id, 10) : undefined,
      ogrenci_fiyati: ogrenci_fiyati !== undefined ? parseFloat(ogrenci_fiyati) : undefined,
      personel_fiyati: personel_fiyati !== undefined ? parseFloat(personel_fiyati) : undefined,
      yemek_ids: Array.isArray(yemek_ids) ? yemek_ids.map(id => parseInt(id, 10)) : undefined
    });

    // Eski anahtarı geçersizleştir
    if (eskiMenu) {
      await menuCacheInvalidate(eskiMenu.yemekhane_id, eskiMenu.tarih, eskiMenu.ogun_id);
    }

    // Eğer yemekhane, tarih veya öğün değiştiyse yeni anahtarı da geçersizleştir
    const yeniYh = yemekhane_id !== undefined ? parseInt(yemekhane_id, 10) : eskiMenu?.yemekhane_id;
    const yeniTarih = tarih !== undefined ? tarih : eskiMenu?.tarih;
    const yeniOgun = ogun_id !== undefined ? parseInt(ogun_id, 10) : eskiMenu?.ogun_id;

    if (
      eskiMenu &&
      (yeniYh !== eskiMenu.yemekhane_id || yeniTarih !== eskiMenu.tarih || yeniOgun !== eskiMenu.ogun_id)
    ) {
      await menuCacheInvalidate(yeniYh, yeniTarih, yeniOgun);
    }

    return res.json({ mesaj: 'Menü başarıyla güncellendi.' });
  } catch (err) {
    return handleDatabaseError(err, res);
  }
}

module.exports = {
  getAdminYemekler,
  getAdminMenuler,
  createAdminMenu,
  updateAdminMenu
};
