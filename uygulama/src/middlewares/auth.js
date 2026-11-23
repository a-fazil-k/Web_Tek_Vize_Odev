const crypto = require('crypto');
const bcrypt = require('bcryptjs');

// Aşama 3'te Redis'e taşınacak basit bellek içi (in-memory Map) oturum deposu
const oturumDeposu = new Map();

// Oturum oluşturma
function oturumOlustur(kullanici) {
  const oturumId = crypto.randomUUID();
  oturumDeposu.set(oturumId, {
    id: kullanici.id,
    ad: kullanici.ad,
    soyad: kullanici.soyad,
    eposta: kullanici.eposta,
    rol: kullanici.rol,
    ogrenci_no: kullanici.ogrenci_no,
    olusturma: new Date()
  });
  return oturumId;
}

// Oturum silme
function oturumSil(oturumId) {
  if (oturumId) {
    oturumDeposu.delete(oturumId);
  }
}

// Oturum getirme
function oturumGetir(oturumId) {
  if (!oturumId) return null;
  return oturumDeposu.get(oturumId) || null;
}

// Zorunlu oturum kontrol middleware'i
function oturumZorunlu(req, res, next) {
  const oturumId = req.cookies?.oturum_id;
  const kullanici = oturumGetir(oturumId);

  if (!kullanici) {
    return res.status(401).json({ hata: 'Oturum açmanız gerekiyor.' });
  }

  req.user = kullanici;
  next();
}

// İsteğe bağlı oturum middleware'i (giriş yapılmışsa kullanıcı bilgisini ekler)
function oturumOpsiyonel(req, res, next) {
  const oturumId = req.cookies?.oturum_id;
  const kullanici = oturumGetir(oturumId);

  if (kullanici) {
    req.user = kullanici;
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
  oturumZorunlu,
  oturumOpsiyonel,
  rolGerektir,
  sifreDogrula,
  sifreHashle
};
