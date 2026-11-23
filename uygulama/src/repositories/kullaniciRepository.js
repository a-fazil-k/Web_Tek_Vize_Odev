const { primaryPool, replicaPool } = require('../config/db');

async function findByEmail(eposta) {
  const [rows] = await replicaPool.query(
    'SELECT id, ad, soyad, eposta, sifre_hash, rol, ogrenci_no, bakiye, aktif, olusturma FROM kullanicilar WHERE eposta = ?',
    [eposta]
  );
  return rows[0] || null;
}

async function findById(id, { taze = false } = {}) {
  const pool = taze ? primaryPool : replicaPool;
  const [rows] = await pool.query(
    'SELECT id, ad, soyad, eposta, rol, ogrenci_no, bakiye, aktif, olusturma FROM kullanicilar WHERE id = ?',
    [id]
  );
  return rows[0] || null;
}

async function getBakiye(id, { taze = false } = {}) {
  const pool = taze ? primaryPool : replicaPool;
  const [rows] = await pool.query(
    'SELECT bakiye FROM kullanicilar WHERE id = ?',
    [id]
  );
  return rows[0] ? rows[0].bakiye : null;
}

module.exports = {
  findByEmail,
  findById,
  getBakiye
};
