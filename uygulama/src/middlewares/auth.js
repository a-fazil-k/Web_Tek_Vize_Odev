const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const redis = require('../config/redis');

// Oturum süresi: 30 dakika (1800 saniye)
const OTURUM_SURESI_SANIYE = 1800;

// Oturum oluşturma (Redis: SET oturum:{token} <json> EX 1800)
async function oturumOlustur(kullanici) {
  const oturumId = crypto.randomUUID();
  const oturumVerisi = {
    id: kullanici.id,
    ad: kullanici.ad,
    soyad: kullanici.soyad,
    eposta: kullanici.eposta,
    rol: kullanici.rol,
    ogrenci_no: kullanici.ogrenci_no,
    olusturma: new Date().toISOString()
  };

  await redis.set(
    `oturum:${oturumId}`,
    JSON.stringify(oturumVerisi),
    'EX',
    OTURUM_SURESI_SANIYE
  );

  return oturumId;
}

// Oturum silme (Redis: DEL oturum:{token})
async function oturumSil(oturumId) {
  if (oturumId) {
    await redis.del(`oturum:${oturumId}`);
  }
}

// Oturum getirme (Redis: GET oturum:{token})
async function oturumGetir(oturumId) {
  if (!oturumId) return null;
  try {
    const raw = await redis.get(`oturum:${oturumId}`);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    console.error('[REDIS OTURUM HATA] Oturum okunamadi:', err.message);
    return null;
  }
}

// Oturum süresini uzatma (Redis: EXPIRE oturum:{token} 1800 - Sliding Expiration)
async function oturumYenile(oturumId) {
  if (oturumId) {
    try {
      await redis.expire(`oturum:${oturumId}`, OTURUM_SURESI_SANIYE);
    } catch (err) {
      console.error('[REDIS OTURUM HATA] Oturum suresi uzatilamadi:', err.message);
    }
  }
}

// Zorunlu oturum kontrol middleware'i
async function oturumZorunlu(req, res, next) {
  const oturumId = req.cookies?.oturum_id;
  if (!oturumId) {
    return res.status(401).json({ hata: 'Oturum açmanız gerekiyor.' });
  }

  const kullanici = await oturumGetir(oturumId);
  if (!kullanici) {
    return res.status(401).json({ hata: 'Oturum açmanız gerekiyor.' });
  }

  // Sliding expiration: süreyi 30 dakikaya yenile
  await oturumYenile(oturumId);

  req.user = kullanici;
  next();
}

// İsteğe bağlı oturum middleware'i (giriş yapılmışsa kullanıcı bilgisini ekler)
async function oturumOpsiyonel(req, res, next) {
  const oturumId = req.cookies?.oturum_id;
  if (oturumId) {
    const kullanici = await oturumGetir(oturumId);
    if (kullanici) {
      await oturumYenile(oturumId);
      req.user = kullanici;
    }
  }
  next();
}

// Rol kontrol middleware'i
function rolGerektir(...roller) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ hata: 'Oturum açmanız gerekiyor.' });
    }
    if (!roller.includes(req.user.rol)) {
      return res.status(403).json({ hata: 'Bu işlem için yetkiniz bulunmuyor.' });
    }
    next();
  };
}

// Şifre doğrulama (bcryptjs)
async function sifreDogrula(duzSifre, hash) {
  return bcrypt.compare(duzSifre, hash);
}

// Şifre hashleme (bcryptjs)
async function sifreHashle(duzSifre) {
  return bcrypt.hash(duzSifre, 10);
}

module.exports = {
  oturumOlustur,
  oturumSil,
  oturumGetir,
  oturumYenile,
  oturumZorunlu,
  oturumOpsiyonel,
  rolGerektir,
  sifreDogrula,
  sifreHashle
};
