const { primaryPool, replicaPool } = require('../config/db');

// Sistemdeki tüm alerjenleri sıralı olarak getirir
async function getAllAlerjenler() {
  const [rows] = await replicaPool.query(
    'SELECT id, ad FROM alerjenler ORDER BY id ASC'
  );
  return rows;
}

// Belirtilen kullanıcının seçtiği alerjenlerin listesini getirir
async function getKullaniciAlerjenleri(kullaniciId, { taze = false } = {}) {
  const pool = taze ? primaryPool : replicaPool;
  const [rows] = await pool.query(
    `SELECT a.id, a.ad 
     FROM kullanici_alerjenleri ka
     JOIN alerjenler a ON a.id = ka.alerjen_id
     WHERE ka.kullanici_id = ?
     ORDER BY a.id ASC`,
    [kullaniciId]
  );
  return rows;
}

// Belirtilen kullanıcının seçtiği alerjen ID'lerini sayı dizisi olarak getirir
async function getKullaniciAlerjenIdleri(kullaniciId, { taze = false } = {}) {
  const pool = taze ? primaryPool : replicaPool;
  const [rows] = await pool.query(
    'SELECT alerjen_id FROM kullanici_alerjenleri WHERE kullanici_id = ?',
    [kullaniciId]
  );
  return rows.map(r => r.alerjen_id);
}

// Kullanıcının alerjen tercihlerini günceller (Primary Pool üzerinde Transaction ile)
async function setKullaniciAlerjenleri(kullaniciId, alerjenIds = []) {
  const connection = await primaryPool.getConnection();
  try {
    await connection.beginTransaction();

    // Önceki seçimleri temizle
    await connection.query(
      'DELETE FROM kullanici_alerjenleri WHERE kullanici_id = ?',
      [kullaniciId]
    );

    // Yeni seçimleri doğrula ve tekilleştir
    const uniqueIds = Array.from(
      new Set(
        (Array.isArray(alerjenIds) ? alerjenIds : [])
          .map(id => parseInt(id, 10))
          .filter(id => !isNaN(id) && id > 0)
      )
    );

    if (uniqueIds.length > 0) {
      const values = uniqueIds.map(aId => [kullaniciId, aId]);
      await connection.query(
        'INSERT INTO kullanici_alerjenleri (kullanici_id, alerjen_id) VALUES ?',
        [values]
      );
    }

    await connection.commit();

    // Güncel alerjen listesini taze olarak oku
    const [guncel] = await connection.query(
      `SELECT a.id, a.ad 
       FROM kullanici_alerjenleri ka
       JOIN alerjenler a ON a.id = ka.alerjen_id
       WHERE ka.kullanici_id = ?
       ORDER BY a.id ASC`,
      [kullaniciId]
    );
    return guncel;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

module.exports = {
  getAllAlerjenler,
  getKullaniciAlerjenleri,
  getKullaniciAlerjenIdleri,
  setKullaniciAlerjenleri
};
