const yemekhaneRepository = require('../repositories/yemekhaneRepository');
const menuRepository = require('../repositories/menuRepository');
const rezervasyonRepository = require('../repositories/rezervasyonRepository');

// Tarih yardımcısı: YYYY-MM-DD
function getBugunISO() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// Menü satırlarını gruplayıp toplam kalori ve iş kurallarını hesaplayan yardımcı
function formatMenuler(rows, user = null, userReservations = []) {
  const rezMap = new Map();
  userReservations.forEach(r => rezMap.set(r.menu_id, { rezervasyon_id: r.rezervasyon_id, durum: r.durum }));

  const menuMap = new Map();
  const now = new Date();

  for (const row of rows) {
    if (!menuMap.has(row.menu_id)) {
      const rezervasyonSon = new Date(row.rezervasyon_son);
      const sonSaatGecti = now >= rezervasyonSon;

      let gecerliFiyat = row.ogrenci_fiyati;
      if (user) {
        gecerliFiyat = user.rol === 'ogrenci' ? row.ogrenci_fiyati : row.personel_fiyati;
      }

      const userRez = rezMap.get(row.menu_id) || null;

      menuMap.set(row.menu_id, {
        id: row.menu_id,
        menu_id: row.menu_id,
        tarih: row.tarih,
        yemekhane_id: row.yemekhane_id,
        yemekhane: row.yemekhane,
        ogun_id: row.ogun_id,
        ogun: row.ogun,
        ogun_sira: row.ogun_sira,
        rezervasyon_son: row.rezervasyon_son,
        son_saat_gecti: sonSaatGecti,
        ogrenci_fiyati: row.ogrenci_fiyati,
        personel_fiyati: row.personel_fiyati,
        fiyat: gecerliFiyat,
        kapasite: row.kapasite,
        rezerve: row.rezerve,
        bos_yer: row.bos_yer,
        doluluk_yuzde: row.doluluk_yuzde,
        oy_sayisi: row.oy_sayisi || 0,
        ortalama_puan: row.ortalama_puan !== null ? Number(row.ortalama_puan) : null,
        kullanici_rezervasyonu: userRez,
        yemekler: [],
        toplam_kalori: 0
      });
    }

    const menu = menuMap.get(row.menu_id);
    if (row.yemek_id) {
      menu.yemekler.push({
        id: row.yemek_id,
        yemek_id: row.yemek_id,
        ad: row.yemek,
        kategori_id: row.kategori_id,
        kategori: row.kategori,
        kategori_sira: row.kategori_sira,
        kalori: Number(row.kalori) || 0,
        vejetaryen: Boolean(row.vejetaryen),
        alerjenler: row.alerjenler ? row.alerjenler.split(', ') : [],
        alerjen_idler: row.alerjen_idler ? row.alerjen_idler.split(',').map(Number) : []
      });
      menu.toplam_kalori += Number(row.kalori) || 0;
    }
  }

  return Array.from(menuMap.values());
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

    const rows = await menuRepository.getMenuDetayRows({
      baslangic: tarih,
      bitis: null,
      yemekhane_id
    });

    let userRez = [];
    if (req.user) {
      const menuIds = [...new Set(rows.map(r => r.menu_id))];
      if (menuIds.length > 0) {
        userRez = await rezervasyonRepository.getKullaniciRezervasyonDurumlari(req.user.id, menuIds);
      }
    }

    const menuler = formatMenuler(rows, req.user, userRez);
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

    const rows = await menuRepository.getMenuDetayRows({
      baslangic,
      bitis,
      yemekhane_id
    });

    let userRez = [];
    if (req.user) {
      const menuIds = [...new Set(rows.map(r => r.menu_id))];
      if (menuIds.length > 0) {
        userRez = await rezervasyonRepository.getKullaniciRezervasyonDurumlari(req.user.id, menuIds);
      }
    }

    const menuler = formatMenuler(rows, req.user, userRez);
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
