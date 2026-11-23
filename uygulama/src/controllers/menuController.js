const yemekhaneRepository = require('../repositories/yemekhaneRepository');
const menuRepository = require('../repositories/menuRepository');
const rezervasyonRepository = require('../repositories/rezervasyonRepository');
const alerjenRepository = require('../repositories/alerjenRepository');
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

  // 2. Kullanıcı oturum açmışsa rezervasyon durumlarını ve alerjen tercihlerini al
  const rezMap = new Map();
  let kullaniciAlerjenIds = new Set();
  if (user) {
    const menuIds = menulerDoluluk.map(m => m.menu_id);
    if (menuIds.length > 0) {
      const userRezList = await rezervasyonRepository.getKullaniciRezervasyonDurumlari(user.id, menuIds);
      userRezList.forEach(r => rezMap.set(r.menu_id, {
        rezervasyon_id: r.rezervasyon_id,
        durum: r.durum,
        porsiyon: r.porsiyon
      }));
    }

    try {
      const aIds = await alerjenRepository.getKullaniciAlerjenIdleri(user.id);
      kullaniciAlerjenIds = new Set(aIds);
    } catch (aErr) {
      console.error('Kullanıcı alerjenleri okuma hatası:', aErr.message);
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
        const yemekler = yemekRows.map(y => {
          const alerjenler = y.alerjenler ? y.alerjenler.split(', ').map(s => s.trim()).filter(Boolean) : [];
          const alerjen_idler = y.alerjen_idler ? y.alerjen_idler.split(',').map(n => parseInt(n.trim(), 10)).filter(n => !isNaN(n)) : [];
          return {
            id: y.yemek_id,
            yemek_id: y.yemek_id,
            ad: y.yemek,
            kategori_id: y.kategori_id,
            kategori: y.kategori,
            kategori_sira: y.kategori_sira,
            kalori: Number(y.kalori) || 0,
            vejetaryen: Boolean(y.vejetaryen),
            alerjenler,
            alerjen_idler
          };
        });

        const toplamKalori = yemekler.reduce((sum, y) => sum + y.kalori, 0);
        const ogrenciFiyati = yemekRows[0].ogrenci_fiyati;
        const personelFiyati = yemekRows[0].personel_fiyati;

        // Kahvaltıda yarım porsiyon izni verilmez
        const yarimPorsiyonIzinli = m.ogun !== 'Kahvaltı' && m.ogun_id !== 1;
        const yarimOgrenciFiyati = (parseFloat(ogrenciFiyati) * 0.60).toFixed(2);
        const yarimPersonelFiyati = (parseFloat(personelFiyati) * 0.60).toFixed(2);

        menuIcerik = {
          v: 2,
          ogrenci_fiyati: ogrenciFiyati,
          personel_fiyati: personelFiyati,
          yarim_porsiyon_izinli: yarimPorsiyonIzinli,
          yarim_ogrenci_fiyati: yarimOgrenciFiyati,
          yarim_personel_fiyati: yarimPersonelFiyati,
          yemekler,
          toplam_kalori: toplamKalori
        };

        // Redis'e gün sonu TTL ile yaz
        await menuCacheSet(m.yemekhane_id, m.tarih, m.ogun_id, menuIcerik);
      } else {
        // Yemek kaydı yoksa boş içerik
        menuIcerik = {
          v: 2,
          ogrenci_fiyati: "0.00",
          personel_fiyati: "0.00",
          yarim_porsiyon_izinli: m.ogun !== 'Kahvaltı' && m.ogun_id !== 1,
          yarim_ogrenci_fiyati: "0.00",
          yarim_personel_fiyati: "0.00",
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
    let gecerliYarimFiyat = menuIcerik.yarim_ogrenci_fiyati;
    if (user) {
      gecerliFiyat = user.rol === 'ogrenci' ? menuIcerik.ogrenci_fiyati : menuIcerik.personel_fiyati;
      gecerliYarimFiyat = user.rol === 'ogrenci' ? menuIcerik.yarim_ogrenci_fiyati : menuIcerik.yarim_personel_fiyati;
    }

    // Kullanıcı alerjen tercihlerine göre uyarı eşleştirmesi
    let menuAlerjenUyarisi = false;
    const kullaniciYemekleri = (menuIcerik.yemekler || []).map(y => {
      const eslesenler = [];
      if (kullaniciAlerjenIds.size > 0 && Array.isArray(y.alerjen_idler)) {
        for (let i = 0; i < y.alerjen_idler.length; i++) {
          const aId = y.alerjen_idler[i];
          if (kullaniciAlerjenIds.has(aId)) {
            eslesenler.push(y.alerjenler[i] || `Alerjen ${aId}`);
          }
        }
      }
      const alerjenUyarisi = eslesenler.length > 0;
      if (alerjenUyarisi) {
        menuAlerjenUyarisi = true;
      }
      return {
        ...y,
        alerjen_uyarisi: alerjenUyarisi,
        eslesen_alerjenler: eslesenler
      };
    });

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
      yarim_porsiyon_izinli: menuIcerik.yarim_porsiyon_izinli,
      yarim_ogrenci_fiyati: menuIcerik.yarim_ogrenci_fiyati,
      yarim_personel_fiyati: menuIcerik.yarim_personel_fiyati,
      fiyat: gecerliFiyat,
      yarim_fiyat: gecerliYarimFiyat,
      kapasite: m.kapasite,
      rezerve: m.rezerve,
      bos_yer: m.bos_yer,
      doluluk_yuzde: m.doluluk_yuzde,
      oy_sayisi: m.oy_sayisi || 0,
      ortalama_puan: m.ortalama_puan !== null ? Number(m.ortalama_puan) : null,
      kullanici_rezervasyonu: userRez,
      menu_alerjen_uyarisi: menuAlerjenUyarisi,
      yemekler: kullaniciYemekleri,
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
