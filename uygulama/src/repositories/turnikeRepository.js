const { primaryPool } = require('../config/db');

// sp_turnike_gecis - autocommit açıkken, BEGIN/COMMIT olmadan primary üzerinde çağrılır
async function turnikeGecis(kullaniciId, yemekhaneId, zaman = null) {
  const [rows] = await primaryPool.query(
    'CALL sp_turnike_gecis(?, ?, ?)',
    [kullaniciId, yemekhaneId, zaman]
  );
  const sonuc = rows[0] && rows[0][0] ? rows[0][0] : null;
  return sonuc;
}

module.exports = {
  turnikeGecis
};
