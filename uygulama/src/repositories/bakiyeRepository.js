const { primaryPool, replicaPool } = require('../config/db');

// sp_bakiye_yukle - autocommit açıkken, BEGIN/COMMIT olmadan primary üzerinde çağrılır
async function bakiyeYukle(kullaniciId, tutar) {
  const [rows] = await primaryPool.query('CALL sp_bakiye_yukle(?, ?)', [kullaniciId, tutar]);
  const sonuc = rows[0] && rows[0][0] ? rows[0][0] : null;
  return sonuc;
}

// Bakiye hareket geçmişini getirir (replica veya taze ise primary)
async function getHareketler(kullaniciId, { taze = false } = {}) {
  const pool = taze ? primaryPool : replicaPool;
  const query = `
    SELECT id, tur, tutar, rezervasyon_id, aciklama, olusturma
    FROM bakiye_hareketleri
    WHERE kullanici_id = ?
    ORDER BY olusturma DESC
  `;
  const [rows] = await pool.query(query, [kullaniciId]);
  return rows;
}

module.exports = {
  bakiyeYukle,
  getHareketler
};
