const kullaniciRepository = require('../repositories/kullaniciRepository');
const { oturumOlustur, oturumSil, sifreDogrula } = require('../middlewares/auth');

async function giris(req, res) {
  try {
    const { eposta, sifre } = req.body;

    if (!eposta || !sifre) {
      return res.status(400).json({ hata: 'E-posta ve şifre zorunludur.' });
    }

    const kullanici = await kullaniciRepository.findByEmail(eposta);
    if (!kullanici) {
      return res.status(401).json({ hata: 'E-posta veya şifre hatalı.' });
    }

    if (!kullanici.aktif) {
      return res.status(403).json({ hata: 'Hesabınız pasif durumdadır.' });
    }

    const sifreGecerli = await sifreDogrula(sifre, kullanici.sifre_hash);
    if (!sifreGecerli) {
      return res.status(401).json({ hata: 'E-posta veya şifre hatalı.' });
    }

    const oturumId = oturumOlustur(kullanici);

    res.cookie('oturum_id', oturumId, {
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
      path: '/'
    });

    return res.json({
      mesaj: 'Giriş başarılı.',
      kullanici: {
        id: kullanici.id,
        ad: kullanici.ad,
        soyad: kullanici.soyad,
        eposta: kullanici.eposta,
        rol: kullanici.rol,
        ogrenci_no: kullanici.ogrenci_no,
        bakiye: kullanici.bakiye
      }
    });
  } catch (err) {
    console.error('Giriş hatası:', err);
    return res.status(500).json({ hata: 'Giriş işlemi sırasında hata oluştu.' });
  }
}

async function cikis(req, res) {
  try {
    const oturumId = req.cookies?.oturum_id;
    oturumSil(oturumId);
    res.clearCookie('oturum_id', { path: '/' });
    return res.json({ mesaj: 'Çıkış yapıldı.' });
  } catch (err) {
    console.error('Çıkış hatası:', err);
    return res.status(500).json({ hata: 'Çıkış işlemi sırasında hata oluştu.' });
  }
}

async function ben(req, res) {
  try {
    const taze = req.query.taze === '1';
    const kullanici = await kullaniciRepository.findById(req.user.id, { taze });

    if (!kullanici) {
      return res.status(404).json({ hata: 'Kullanıcı bulunamadı.' });
    }

    return res.json({
      id: kullanici.id,
      ad: kullanici.ad,
      soyad: kullanici.soyad,
      eposta: kullanici.eposta,
      rol: kullanici.rol,
      ogrenci_no: kullanici.ogrenci_no,
      bakiye: kullanici.bakiye
    });
  } catch (err) {
    console.error('Kullanıcı bilgisi hatası:', err);
    return res.status(500).json({ hata: 'Kullanıcı bilgisi alınamadı.' });
  }
}

module.exports = {
  giris,
  cikis,
  ben
};
