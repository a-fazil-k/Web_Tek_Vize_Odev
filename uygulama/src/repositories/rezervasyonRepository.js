const { primaryPool, replicaPool } = require('../config/db');

// sp_rezervasyon_yap - autocommit açıkken, BEGIN/COMMIT olmadan primary üzerinde çağrılır
async function rezervasyonYap(kullaniciId, menuId) {
  const [rows] = await primaryPool.query('CALL sp_rezervasyon_yap(?, ?)', [kullaniciId, menuId]);
  // mysql2 stored procedure çağrılarında ilk sonuç kümesi rows[0]'dır
  const sonuc = rows[0] && rows[0][0] ? rows[0][0] : null;
  return sonuc;
}

// sp_rezervasyon_iptal - autocommit açıkken, BEGIN/COMMIT olmadan primary üzerinde çağrılır
async function rezervasyonIptal(kullaniciId, rezervasyonId) {
  const [rows] = await primaryPool.query('CALL sp_rezervasyon_iptal(?, ?)', [kullaniciId, rezervasyonId]);
  const sonuc = rows[0] && rows[0][0] ? rows[0][0] : null;
  return sonuc;
}

// Kullanıcının tüm rezervasyonlarını getirir (replica)
async function getByKullaniciId(kullaniciId) {
  const query = `
    SELECT 
      r.id, r.menu_id, r.durum, r.ucret, r.olusturma, r.kullanma_zamani, r.iptal_zamani,
      m.tarih, yh.id AS yemekhane_id, yh.ad AS yemekhane,
      o.id AS ogun_id, o.ad AS ogun, o.sira AS ogun_sira,
      TIMESTAMP(m.tarih, o.son_saat) AS rezervasyon_son,
      CASE WHEN NOW() >= TIMESTAMP(m.tarih, o.son_saat) THEN 1 ELSE 0 END AS son_saat_gecti,
      d.id AS degerlendirme_id, d.puan, d.yorum
    FROM rezervasyonlar r
    JOIN menuler m ON m.id = r.menu_id
    JOIN yemekhaneler yh ON yh.id = m.yemekhane_id
    JOIN ogunler o ON o.id = m.ogun_id
    LEFT JOIN degerlendirmeler d ON d.kullanici_id = r.kullanici_id AND d.menu_id = r.menu_id
    WHERE r.kullanici_id = ?
    ORDER BY m.tarih DESC, o.sira DESC
  `;
  const [rows] = await replicaPool.query(query, [kullaniciId]);
  return rows;
}

// Kullanıcının belirli menülerdeki rezervasyon durumlarını getirir
async function getKullaniciRezervasyonDurumlari(kullaniciId, menuIds) {
  if (!menuIds || menuIds.length === 0) return [];
  const query = `
    SELECT id AS rezervasyon_id, menu_id, durum
    FROM rezervasyonlar
    WHERE kullanici_id = ? AND menu_id IN (?)
  `;
  const [rows] = await replicaPool.query(query, [kullaniciId, menuIds]);
  return rows;
}

module.exports = {
  rezervasyonYap,
  rezervasyonIptal,
  getByKullaniciId,
  getKullaniciRezervasyonDurumlari
};
