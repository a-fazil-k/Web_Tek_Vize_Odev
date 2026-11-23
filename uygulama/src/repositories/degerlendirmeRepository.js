const { primaryPool, replicaPool } = require('../config/db');

// Kullanıcının bu menü için 'kullanildi' durumunda rezervasyonu var mı?
async function hasKullanilmisRezervasyon(kullaniciId, menuId) {
  const [rows] = await replicaPool.query(
    `SELECT id FROM rezervasyonlar 
     WHERE kullanici_id = ? AND menu_id = ? AND durum = 'kullanildi' 
     LIMIT 1`,
    [kullaniciId, menuId]
  );
  return rows.length > 0;
}

// Kullanıcının mevcut değerlendirmesi var mı?
async function findByKullaniciAndMenu(kullaniciId, menuId) {
  const [rows] = await replicaPool.query(
    'SELECT id, kullanici_id, menu_id, puan, yorum, olusturma FROM degerlendirmeler WHERE kullanici_id = ? AND menu_id = ?',
    [kullaniciId, menuId]
  );
  return rows[0] || null;
}

// Değerlendirme ekle (primary pool)
async function createDegerlendirme(kullaniciId, menuId, puan, yorum) {
  const [result] = await primaryPool.query(
    `INSERT INTO degerlendirmeler (kullanici_id, menu_id, puan, yorum)
     VALUES (?, ?, ?, ?)`,
    [kullaniciId, menuId, puan, yorum || null]
  );
  return result.insertId;
}

// Menü değerlendirmeleri
async function getByMenuId(menuId) {
  const [rows] = await replicaPool.query(
    `SELECT d.id, d.puan, d.yorum, d.olusturma, k.ad, CONCAT(SUBSTRING(k.soyad, 1, 1), '.') AS soyad_kisaltma
     FROM degerlendirmeler d
     JOIN kullanicilar k ON k.id = d.kullanici_id
     WHERE d.menu_id = ?
     ORDER BY d.olusturma DESC`,
    [menuId]
  );
  return rows;
}

module.exports = {
  hasKullanilmisRezervasyon,
  findByKullaniciAndMenu,
  createDegerlendirme,
  getByMenuId
};
