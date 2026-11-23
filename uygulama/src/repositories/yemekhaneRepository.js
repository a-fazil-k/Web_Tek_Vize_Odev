const { replicaPool } = require('../config/db');

async function getAllYemekhaneler() {
  const [rows] = await replicaPool.query(
    'SELECT id, ad, konum, kapasite FROM yemekhaneler ORDER BY id ASC'
  );
  return rows;
}

async function getAllOgunler() {
  const [rows] = await replicaPool.query(
    'SELECT id, ad, sira, son_saat, servis_baslangic, servis_bitis FROM ogunler ORDER BY sira ASC'
  );
  return rows;
}

module.exports = {
  getAllYemekhaneler,
  getAllOgunler
};
