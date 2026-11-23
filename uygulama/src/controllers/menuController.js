const yemekhaneRepository = require('../repositories/yemekhaneRepository');
const menuRepository = require('../repositories/menuRepository');
const rezervasyonRepository = require('../repositories/rezervasyonRepository');
const { menuCacheGet, menuCacheSet } = require('../services/menuCacheService');

// Tarih yardımcısı: YYYY-MM-DD
function getBugunISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Menüleri önbellek (Redis) + canlı doluluk (MySQL) birleştirerek getirir.
 * - Menü içeriği (yemekler, kalori, fiyatlar) Redis'ten gelir (CACHE HIT / MISS).
 * - Canlı kapasite, doluluk, oy ve kullanıcının rezervasyon durumu anlık olarak tazedir.
 */
async function getVeBirlestirMenuler({ baslangic, bitis, yemekhane_id }, user = null) {
  // 1. İstenen tarih/aralık için temel menü doluluk ve puan kayıtlarını çek (hafif sorgu)
  const menulerDoluluk = await menuRepository.getMenulerDolulukVePuan({
    baslangic,
    bitis,
    yemekhane_id
  });

  if (!menulerDoluluk || menulerDoluluk.length === 0) {
    return [];
  }

  // 2. Kullanıcı oturum açmışsa rezervasyon durumlarını al
  const rezMap = new Map();
  if (user) {
    const menuIds = menulerDoluluk.map(m => m.menu_id);
    if (menuIds.length > 0) {
      const userRezList = await rezervasyonRepository.getKullaniciRezervasyonDurumlari(user.id, menuIds);
      userRezList.forEach(r => rezMap.set(r.menu_id, { rezervasyon_id: r.rezervasyon_id, durum: r.durum }));
    }
  }

  const now = new Date();
  const sonucMenuler = [];

  // 3. Her menü için Redis kontrolü yap
  for (const m of menulerDoluluk) {
    // Redis'ten kontrol et
    let menuIcerik = await menuCacheGet(m.yemekhane_id, m.tarih, m.ogun_id);

    // CACHE MISS: MySQL'den oku ve Redis'e yaz
    if (!menuIcerik) {
      const yemekRows = await menuRepository.findMenuById(m.menu_id);
      if (yemekRows && yemekRows.length > 0) {
        const yemekler = yemekRows.map(y => ({
          id: y.yemek_id,
          yemek_id: y.yemek_id,
          ad: y.yemek,
          kategori_id: y.kategori_id,
          kategori: y.kategori,
          kategori_sira: y.kategori_sira,
          kalori: Number(y.kalori) || 0,
          vejetaryen: Boolean(y.vejetaryen),
          alerjenler: y.alerjenler ? y.alerjenler.split(', ') : [],
          alerjen_idler: y.alerjen_idler ? y.alerjen_idler.split(',').map(Number) : []
        }));

        const toplamKalori = yemekler.reduce((sum, y) => sum + y.kalori, 0);

        menuIcerik = {
          ogrenci_fiyati: yemekRows[0].ogrenci_fiyati,
          personel_fiyati: yemekRows[0].personel_fiyati,
          yemekler,
          toplam_kalori: toplamKalori
        };

        // Redis'e gün sonu TTL ile yaz
        await menuCacheSet(m.yemekhane_id, m.tarih, m.ogun_id, menuIcerik);
      } else {
        // Yemek kaydı yoksa boş içerik
        menuIcerik = {
          ogrenci_fiyati: "0.00",
          personel_fiyati: "0.00",
          yemekler: [],
          toplam_kalori: 0
        };
      }
    }

    // Süre kontrolü
    const rezervasyonSon = new Date(m.rezervasyon_son);
    const sonSaatGecti = now >= rezervasyonSon;

    // Rolüne göre fiyat
    let gecerliFiyat = menuIcerik.ogrenci_fiyati;
    if (user) {
      gecerliFiyat = user.rol === 'ogrenci' ? menuIcerik.ogrenci_fiyati : menuIcerik.personel_fiyati;
    }

    const userRez = rezMap.get(m.menu_id) || null;

    sonucMenuler.push({
      id: m.menu_id,
      menu_id: m.menu_id,
      tarih: m.tarih,
      yemekhane_id: m.yemekhane_id,
      yemekhane: m.yemekhane,
      ogun_id: m.ogun_id,
      ogun: m.ogun,
      rezervasyon_son: m.rezervasyon_son,
      son_saat_gecti: sonSaatGecti,
      ogrenci_fiyati: menuIcerik.ogrenci_fiyati,
      personel_fiyati: menuIcerik.personel_fiyati,
      fiyat: gecerliFiyat,
      kapasite: m.kapasite,
      rezerve: m.rezerve,
      bos_yer: m.bos_yer,
      doluluk_yuzde: m.doluluk_yuzde,
      oy_sayisi: m.oy_sayisi || 0,
      ortalama_puan: m.ortalama_puan !== null ? Number(m.ortalama_puan) : null,
      kullanici_rezervasyonu: userRez,
      yemekler: menuIcerik.yemekler,
      toplam_kalori: menuIcerik.toplam_kalori
    });
  }

  return sonucMenuler;
}

async function getYemekhaneler(req, res) {
  try {
    const yemekhaneler = await yemekhaneRepository.getAllYemekhaneler();
    return res.json(yemekhaneler);
  } catch (err) {
    console.error('Yemekhaneler getirme hatası:', err);
    return res.status(500).json({ hata: 'Yemekhaneler listelenemedi.' });
  }
}

async function getOgunler(req, res) {
  try {
    const ogunler = await yemekhaneRepository.getAllOgunler();
    return res.json(ogunler);
  } catch (err) {
    console.error('Öğünler getirme hatası:', err);
    return res.status(500).json({ hata: 'Öğünler listelenemedi.' });
  }
}

async function getGunlukMenuler(req, res) {
  try {
    const tarih = req.query.tarih || getBugunISO();
    const yemekhane_id = req.query.yemekhane_id ? parseInt(req.query.yemekhane_id, 10) : null;

    const menuler = await getVeBirlestirMenuler(
      { baslangic: tarih, bitis: null, yemekhane_id },
      req.user
    );

    return res.json(menuler);
  } catch (err) {
    console.error('Günlük menü getirme hatası:', err);
    return res.status(500).json({ hata: 'Günlük menüler listelenemedi.' });
  }
}

async function getHaftalikMenuler(req, res) {
  try {
    let baslangic = req.query.baslangic;
    if (!baslangic) {
      baslangic = getBugunISO();
    }

    // Başlangıçtan itibaren 7 gün (örn. Pazartesi - Pazar)
    const startDate = new Date(baslangic);
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 6);
    const bitis = endDate.toISOString().split('T')[0];

    const yemekhane_id = req.query.yemekhane_id ? parseInt(req.query.yemekhane_id, 10) : null;

    const menuler = await getVeBirlestirMenuler(
      { baslangic, bitis, yemekhane_id },
      req.user
    );

    return res.json(menuler);
  } catch (err) {
    console.error('Haftalık menü getirme hatası:', err);
    return res.status(500).json({ hata: 'Haftalık menüler listelenemedi.' });
  }
}

module.exports = {
  getYemekhaneler,
  getOgunler,
  getGunlukMenuler,
  getHaftalikMenuler
};
