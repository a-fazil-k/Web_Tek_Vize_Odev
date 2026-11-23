/**
 * Yemekhane Otomasyonu · Frontend Uygulama Mantığı (Vanilla JS)
 * Aşama 2: Web API Entegrasyonu & 7 Ekran Yönetimi
 */

// Uygulama Durumu (State)
const durum = {
  kullanici: null,
  aktifEkran: 'gunluk',
  yemekhaneler: [],
  ogunler: [],
  adminDuzenlemeId: null
};

// =====================================================================
// MERKEZİ API VE HATA YÖNETİMİ
// =====================================================================

/**
 * Merkezi Fetch Sarmalayıcısı:
 * - Her zaman credentials: 'same-origin' kullanır.
 * - API'den dönen Türkçe 'hata' mesajlarını değiştirmeden yakalar ve fırlatır.
 */
async function apiFetch(url, options = {}) {
  const varsayilanAyarlar = {
    credentials: 'same-origin',
    headers: {
      'Accept': 'application/json'
    }
  };

  const birlesmisAyarlar = {
    ...varsayilanAyarlar,
    ...options,
    headers: {
      ...varsayilanAyarlar.headers,
      ...(options.headers || {})
    }
  };

  // Body bir nesne ise JSON'a çevir
  if (birlesmisAyarlar.body && typeof birlesmisAyarlar.body === 'object' && !(birlesmisAyarlar.body instanceof FormData)) {
    birlesmisAyarlar.headers['Content-Type'] = 'application/json';
    birlesmisAyarlar.body = JSON.stringify(birlesmisAyarlar.body);
  }

  try {
    const yanit = await fetch(url, birlesmisAyarlar);
    let veri = null;

    const contentType = yanit.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      veri = await yanit.json();
    }

    if (!yanit.ok) {
      const hataMesaji = (veri && veri.hata) ? veri.hata : `İşlem başarısız oldu (HTTP ${yanit.status}).`;
      bildirimGoster(hataMesaji, 'hata');
      throw new Error(hataMesaji);
    }

    return veri;
  } catch (err) {
    // Ağ kopması vb. durumlar
    if (!err.message) {
      bildirimGoster('Sunucuyla iletişim kurulamadı.', 'hata');
    }
    throw err;
  }
}

/**
 * Toast Bildirim Sistemi (Hata, Başarı, Bilgi)
 */
function bildirimGoster(mesaj, tur = 'bilgi') {
  const kapsayici = document.getElementById('toast-kapsayici');
  if (!kapsayici) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${tur}`;
  toast.setAttribute('role', 'alert');

  const icerik = document.createElement('div');
  icerik.textContent = mesaj;

  const kapatBtn = document.createElement('button');
  kapatBtn.className = 'toast-kapat';
  kapatBtn.innerHTML = '&times;';
  kapatBtn.title = 'Kapat';
  kapatBtn.onclick = () => toast.remove();

  toast.appendChild(icerik);
  toast.appendChild(kapatBtn);
  kapsayici.appendChild(toast);

  // 4 saniye sonra otomatik kapanma
  setTimeout(() => {
    if (toast.isConnected) {
      toast.style.opacity = '0';
      toast.style.transition = 'opacity 0.3s';
      setTimeout(() => toast.remove(), 300);
    }
  }, 4000);
}

// Bakiye göstergelerini tüm arayüzde anında güncelleyen fonksiyon
function bakiyeGuncelle(yeniBakiye) {
  if (yeniBakiye === undefined || yeniBakiye === null) return;
  const bakiyeStr = parseFloat(yeniBakiye).toFixed(2);
  if (durum.kullanici) {
    durum.kullanici.bakiye = bakiyeStr;
  }

  const ustBakiyeEl = document.getElementById('ust-bakiye-deger');
  if (ustBakiyeEl) ustBakiyeEl.textContent = `${bakiyeStr} TL`;

  const kartBakiyeEl = document.getElementById('bakiye-ekran-tutar');
  if (kartBakiyeEl) kartBakiyeEl.textContent = `${bakiyeStr} TL`;
}

// =====================================================================
// BAŞLANGIÇ VE OTURUM KONTROLÜ
// =====================================================================

document.addEventListener('DOMContentLoaded', async () => {
  navigasyonAyarla();
  await yemekhaneVeOgunleriYukle();
  await oturumKontrol();
});

// Sekme geçişlerini dinle
function navigasyonAyarla() {
  const sekmeler = document.querySelectorAll('.nav-sekme');
  sekmeler.forEach(sekme => {
    sekme.addEventListener('click', (e) => {
      const hedefEkran = e.currentTarget.getAttribute('data-ekran');
      ekranDegistir(hedefEkran);
    });
  });
}

function ekranDegistir(ekranAdi) {
  durum.aktifEkran = ekranAdi;

  // Sekme butonlarını güncelle
  document.querySelectorAll('.nav-sekme').forEach(s => {
    if (s.getAttribute('data-ekran') === ekranAdi) {
      s.classList.add('aktif');
    } else {
      s.classList.remove('aktif');
    }
  });

  // Ekran bloklarını güncelle
  document.querySelectorAll('.ekran').forEach(e => {
    if (e.id === `ekran-${ekranAdi}`) {
      e.classList.add('aktif');
    } else {
      e.classList.remove('aktif');
    }
  });

  // Ekran içeriğini yükle
  if (ekranAdi === 'gunluk') gunlukMenuleriYukle();
  if (ekranAdi === 'haftalik') haftalikMenuleriYukle();
  if (ekranAdi === 'rezervasyonlar') rezervasyonlariYukle();
  if (ekranAdi === 'bakiye') bakiyeEkraniniYukle();
  if (ekranAdi === 'degerlendirme') degerlendirmeleriYukle();
  if (ekranAdi === 'admin') adminPaneliniYukle();
  if (ekranAdi === 'profil') profilEkraniniYukle();
}

// Oturum durumunu kontrol et
async function oturumKontrol() {
  try {
    const kullanici = await apiFetch('/api/auth/ben?taze=1');
    durum.kullanici = kullanici;
    kullaniciArayuzunuGuncelle();
  } catch (err) {
    durum.kullanici = null;
    kullaniciArayuzunuGuncelle();
  }
  // Başlangıç ekranını yükle
  ekranDegistir('gunluk');
}

// Kullanıcı oturum durumuna göre üst barı ve sekmeleri güncelle
function kullaniciArayuzunuGuncelle() {
  const girisBtn = document.getElementById('btn-nav-giris');
  const profilKutusu = document.getElementById('ust-kullanici-alani');
  const adminSekme = document.getElementById('sekme-admin');
  const rezSekme = document.getElementById('sekme-rezervasyonlar');
  const bakiyeSekme = document.getElementById('sekme-bakiye');
  const degSekme = document.getElementById('sekme-degerlendirme');
  const profilSekme = document.getElementById('sekme-profil');

  if (durum.kullanici) {
    if (girisBtn) girisBtn.style.display = 'none';
    if (profilKutusu) {
      profilKutusu.style.display = 'flex';
      document.getElementById('ust-kullanici-ad').textContent = `${durum.kullanici.ad} ${durum.kullanici.soyad}`;
      
      const rolEl = document.getElementById('ust-rol-rozet');
      rolEl.textContent = durum.kullanici.rol;
      rolEl.className = `rol-rozet ${durum.kullanici.rol}`;

      bakiyeGuncelle(durum.kullanici.bakiye);
    }

    if (rezSekme) rezSekme.style.display = 'flex';
    if (bakiyeSekme) bakiyeSekme.style.display = 'flex';
    if (degSekme) degSekme.style.display = 'flex';
    if (profilSekme) profilSekme.style.display = 'flex';

    if (durum.kullanici.rol === 'yonetici') {
      if (adminSekme) adminSekme.style.display = 'flex';
    } else {
      if (adminSekme) adminSekme.style.display = 'none';
    }
  } else {
    if (girisBtn) girisBtn.style.display = 'inline-flex';
    if (profilKutusu) profilKutusu.style.display = 'none';
    if (adminSekme) adminSekme.style.display = 'none';
    if (rezSekme) rezSekme.style.display = 'none';
    if (bakiyeSekme) bakiyeSekme.style.display = 'none';
    if (degSekme) degSekme.style.display = 'none';
    if (profilSekme) profilSekme.style.display = 'none';
  }
}

// Ortak verileri yükle: Yemekhaneler ve Öğünler
async function yemekhaneVeOgunleriYukle() {
  try {
    const [yhList, ogList] = await Promise.all([
      apiFetch('/api/yemekhaneler'),
      apiFetch('/api/ogunler')
    ]);
    durum.yemekhaneler = yhList || [];
    durum.ogunler = ogList || [];

    filtreSecenekleriniDoldur();
  } catch (err) {
    console.error('Yemekhane ve öğünler alınamadı:', err);
  }
}

function filtreSecenekleriniDoldur() {
  const filtreYemekhaneGunluk = document.getElementById('filtre-gunluk-yemekhane');
  const filtreYemekhaneHaftalik = document.getElementById('filtre-haftalik-yemekhane');
  const filtreAdminYemekhane = document.getElementById('admin-menu-yemekhane');
  const filtreAdminRaporYh = document.getElementById('admin-rapor-yemekhane');
  const formAdminOgun = document.getElementById('admin-menu-ogun');

  const yhSecenekleri = '<option value="">Tüm Yemekhaneler</option>' +
    durum.yemekhaneler.map(y => `<option value="${y.id}">${y.ad}</option>`).join('');

  if (filtreYemekhaneGunluk) filtreYemekhaneGunluk.innerHTML = yhSecenekleri;
  if (filtreYemekhaneHaftalik) filtreYemekhaneHaftalik.innerHTML = yhSecenekleri;
  if (filtreAdminRaporYh) filtreAdminRaporYh.innerHTML = yhSecenekleri;

  if (filtreAdminYemekhane) {
    filtreAdminYemekhane.innerHTML = durum.yemekhaneler.map(y => `<option value="${y.id}">${y.ad}</option>`).join('');
  }

  if (formAdminOgun) {
    formAdminOgun.innerHTML = durum.ogunler.map(o => `<option value="${o.id}">${o.ad} (${o.son_saat.substring(0,5)} son saat)</option>`).join('');
  }
}

// =====================================================================
// 1. EKRAN: GİRİŞ VE ÇIKIŞ
// =====================================================================

async function girisYap(e) {
  if (e) e.preventDefault();
  const eposta = document.getElementById('giris-eposta').value.trim();
  const sifre = document.getElementById('giris-sifre').value.trim();

  if (!eposta || !sifre) {
    bildirimGoster('Lütfen e-posta ve şifrenizi girin.', 'hata');
    return;
  }

  try {
    const yanit = await apiFetch('/api/auth/giris', {
      method: 'POST',
      body: { eposta, sifre }
    });

    durum.kullanici = yanit.kullanici;
    bildirimGoster(`Hoş geldiniz, ${yanit.kullanici.ad}!`, 'basari');
    kullaniciArayuzunuGuncelle();
    ekranDegistir('gunluk');
  } catch (err) {
    // Hata mesajı apiFetch içinde bildirim olarak fırlatılır
  }
}

async function cikisYap() {
  try {
    await apiFetch('/api/auth/cikis', { method: 'POST' });
    durum.kullanici = null;
    kullaniciArayuzunuGuncelle();
    bildirimGoster('Başarıyla çıkış yapıldı.', 'bilgi');
    ekranDegistir('gunluk');
  } catch (err) {
    console.error('Çıkış hatası:', err);
  }
}

// =====================================================================
// 2. EKRAN: GÜNÜN MENÜSÜ
// =====================================================================

async function gunlukMenuleriYukle() {
  const listeKapsayici = document.getElementById('gunluk-menu-listesi');
  if (!listeKapsayici) return;

  listeKapsayici.innerHTML = '<p class="bildirim bildirim-bilgi">Menüler yükleniyor...</p>';

  const yemekhaneId = document.getElementById('filtre-gunluk-yemekhane')?.value || '';
  const ogunId = document.getElementById('filtre-gunluk-ogun')?.value || '';
  const tarih = document.getElementById('filtre-gunluk-tarih')?.value || '';

  let url = '/api/menuler/gunluk?';
  const params = [];
  if (yemekhaneId) params.push(`yemekhane_id=${yemekhaneId}`);
  if (tarih) params.push(`tarih=${tarih}`);
  url += params.join('&');

  try {
    let menuler = await apiFetch(url);
    if (ogunId) {
      menuler = menuler.filter(m => String(m.ogun_id) === String(ogunId));
    }

    if (!menuler || menuler.length === 0) {
      listeKapsayici.innerHTML = '<p class="bildirim bildirim-bilgi">Seçilen kriterlere uygun günün menüsü bulunamadı.</p>';
      return;
    }

    listeKapsayici.innerHTML = '';
    const izgara = document.createElement('div');
    izgara.className = 'menu-izgara';

    menuler.forEach(menu => {
      izgara.appendChild(menuKartiOlustur(menu, true));
    });

    listeKapsayici.appendChild(izgara);
  } catch (err) {
    listeKapsayici.innerHTML = '<p class="bildirim bildirim-hata">Günün menüsü yüklenirken bir hata oluştu.</p>';
  }
}

// =====================================================================
// 3. EKRAN: HAFTALIK MENÜ VE REZERVASYON
// =====================================================================

async function haftalikMenuleriYukle() {
  const listeKapsayici = document.getElementById('haftalik-menu-listesi');
  if (!listeKapsayici) return;

  listeKapsayici.innerHTML = '<p class="bildirim bildirim-bilgi">Haftalık menüler yükleniyor...</p>';

  const yemekhaneId = document.getElementById('filtre-haftalik-yemekhane')?.value || '';
  const baslangic = document.getElementById('filtre-haftalik-baslangic')?.value || '';

  let url = '/api/menuler/haftalik?';
  const params = [];
  if (yemekhaneId) params.push(`yemekhane_id=${yemekhaneId}`);
  if (baslangic) params.push(`baslangic=${baslangic}`);
  url += params.join('&');

  try {
    const menuler = await apiFetch(url);
    if (!menuler || menuler.length === 0) {
      listeKapsayici.innerHTML = '<p class="bildirim bildirim-bilgi">Seçilen aralıkta menü bulunamadı.</p>';
      return;
    }

    listeKapsayici.innerHTML = '';
    const izgara = document.createElement('div');
    izgara.className = 'menu-izgara';

    menuler.forEach(menu => {
      izgara.appendChild(menuKartiOlustur(menu, false));
    });

    listeKapsayici.appendChild(izgara);
  } catch (err) {
    listeKapsayici.innerHTML = '<p class="bildirim bildirim-hata">Haftalık menüler yüklenirken bir hata oluştu.</p>';
  }
}

/**
 * Menü Kartı DOM Elemanı Üreticisi:
 * Günlük ve Haftalık ekranlarında ortak kullanılır.
 */
function menuKartiOlustur(menu, tekGun = false) {
  const kart = document.createElement('div');
  kart.className = 'menu-kart';

  // Formatlı tarih
  const tarihParcalari = menu.tarih.split('-');
  const formatliTarih = `${tarihParcalari[2]}.${tarihParcalari[1]}.${tarihParcalari[0]}`;

  // Menü düzeyinde alerjen uyarı şeridi (Kullanıcı profiliyle eşleşen alerjen varsa)
  let alerjenUyariSeridi = '';
  if (menu.menu_alerjen_uyarisi) {
    alerjenUyariSeridi = `
      <div class="menu-alerjen-uyari-serit">
        <span>⚠️</span>
        <span>Alerjen Uyarısı: Bu menüde tercihlerinizle eşleşen yemek(ler) var!</span>
      </div>
    `;
  }

  // Yemek satırları
  const yemeklerHtml = (menu.yemekler || []).map(y => {
    let vejetaryenHtml = y.vejetaryen ? '<span class="etiket etiket-vejetaryen">🌱 Vejetaryen</span>' : '';
    let alerjenHtml = '';

    if (y.alerjen_uyarisi) {
      const uyarilar = (y.eslesen_alerjenler && y.eslesen_alerjenler.length > 0)
        ? y.eslesen_alerjenler.join(', ')
        : (y.alerjenler ? y.alerjenler.join(', ') : 'Alerjen');
      alerjenHtml = `<span class="etiket etiket-alerjen-tehlike" title="Alerjen profilinizle eşleşti!">⚠️ Alerjen Uyarısı: ${uyarilar}</span>`;
    } else if (y.alerjenler && y.alerjenler.length > 0) {
      alerjenHtml = `<span class="etiket etiket-alerjen">ℹ️ ${y.alerjenler.join(', ')}</span>`;
    }

    const ogeSinifi = y.alerjen_uyarisi ? 'yemek-ogesi yemek-ogesi-alerjenli' : 'yemek-ogesi';

    return `
      <li class="${ogeSinifi}">
        <div class="yemek-baslik-satir">
          <span class="yemek-ad">${y.ad}</span>
          <span class="yemek-kalori">${y.kalori} kcal</span>
        </div>
        <div class="yemek-etiketler">
          ${vejetaryenHtml}
          ${alerjenHtml}
        </div>
      </li>
    `;
  }).join('');

  // Rezervasyon Butonu / Durum Alanı Kurgusu
  let butonVeDurumHtml = '';
  const bosYer = Number(menu.bos_yer);
  const sonSaatGecti = Boolean(menu.son_saat_gecti);
  const rez = menu.kullanici_rezervasyonu;

  let dolulukSinifi = '';
  if (bosYer <= 0) dolulukSinifi = 'dolu';
  else if (bosYer <= 10) dolulukSinifi = 'az-kaldi';

  if (!durum.kullanici) {
    butonVeDurumHtml = `
      <div class="menu-fiyat-alani">
        <span class="fiyat-etiket">Öğrenci / Personel</span>
        <span class="fiyat-deger">${menu.ogrenci_fiyati} / ${menu.personel_fiyati} TL</span>
      </div>
      <button class="dugme dugme-ikincil dugme-kucuk" onclick="ekranDegistir('giris')">Giriş Yap ve Rezerve Et</button>
    `;
  } else {
    // Giriş yapılmış: kullanıcının rolüne göre tam ve yarım porsiyon fiyatları
    const tamFiyat = menu.fiyat || (durum.kullanici.rol === 'ogrenci' ? menu.ogrenci_fiyati : menu.personel_fiyati);
    const yarimFiyat = menu.yarim_fiyat || (durum.kullanici.rol === 'ogrenci' ? menu.yarim_ogrenci_fiyati : menu.yarim_personel_fiyati);
    const yarimIzinli = Boolean(menu.yarim_porsiyon_izinli);

    let eylemHtml = '';
    if (rez) {
      if (rez.durum === 'aktif') {
        const porsiyonMetni = rez.porsiyon === 'yarim' ? ' (Yarım Porsiyon)' : ' (Tam Porsiyon)';
        eylemHtml = `<span class="durum-rozet durum-aktif">Rezerve Edildi${porsiyonMetni}</span>`;
      } else if (rez.durum === 'kullanildi') {
        const porsiyonMetni = rez.porsiyon === 'yarim' ? ' (Yarım)' : ' (Tam)';
        eylemHtml = `<span class="durum-rozet durum-kullanildi">Kullanıldı${porsiyonMetni}</span>`;
      }
    } else if (sonSaatGecti) {
      eylemHtml = '<button class="dugme dugme-ikincil dugme-kucuk" disabled>Süresi Doldu</button>';
    } else if (bosYer <= 0) {
      eylemHtml = '<button class="dugme dugme-ikincil dugme-kucuk" disabled>Kapasite Dolu</button>';
    } else {
      if (yarimIzinli) {
        eylemHtml = `
          <div class="porsiyon-secim-kapsayici">
            <span class="porsiyon-etiket">Porsiyon:</span>
            <div class="porsiyon-secici" role="radiogroup" aria-label="Porsiyon Seçimi">
              <label class="porsiyon-secenek">
                <input type="radio" name="porsiyon_${menu.menu_id}" value="tam" checked onchange="porsiyonFiyatGuncelle(${menu.menu_id}, '${tamFiyat}')">
                <span>Tam</span>
              </label>
              <label class="porsiyon-secenek">
                <input type="radio" name="porsiyon_${menu.menu_id}" value="yarim" onchange="porsiyonFiyatGuncelle(${menu.menu_id}, '${yarimFiyat}')">
                <span>Yarım (%60)</span>
              </label>
            </div>
          </div>
          <button class="dugme dugme-ana dugme-kucuk" onclick="menuRezervasyonTikla(${menu.menu_id})">Rezervasyon Yap</button>
        `;
      } else {
        eylemHtml = `
          <span class="porsiyon-kahvalti-not">(Yalnızca tam porsiyon)</span>
          <button class="dugme dugme-ana dugme-kucuk" onclick="rezervasyonYap(${menu.menu_id}, 'tam')">Rezervasyon Yap</button>
        `;
      }
    }

    butonVeDurumHtml = `
      <div class="menu-fiyat-alani">
        <span class="fiyat-etiket">${durum.kullanici.rol === 'ogrenci' ? 'Öğrenci Fiyatı' : 'Personel Fiyatı'}</span>
        <span id="menu-fiyat-${menu.menu_id}" class="fiyat-deger">${tamFiyat} TL</span>
      </div>
      <div>${eylemHtml}</div>
    `;
  }

  // Puan gösterimi (varsa)
  let puanHtml = '';
  if (menu.ortalama_puan !== null && menu.ortalama_puan !== undefined) {
    puanHtml = `<span>⭐ <strong>${menu.ortalama_puan}</strong> (${menu.oy_sayisi} oy)</span>`;
  }

  kart.innerHTML = `
    <div class="menu-kart-ust">
      <div>
        <div class="menu-tarih-ogun">${formatliTarih} · ${menu.ogun}</div>
        <div class="menu-yemekhane">${menu.yemekhane}</div>
      </div>
      ${puanHtml}
    </div>
    ${alerjenUyariSeridi}
    <div class="menu-kart-govde">
      <ul class="yemek-listesi">
        ${yemeklerHtml}
      </ul>
      <div class="menu-ozet-satir">
        <span>Toplam Kalori: <strong>${menu.toplam_kalori} kcal</strong></span>
        <span class="doluluk-bilgi ${dolulukSinifi}">Boş Yer: <strong>${menu.bos_yer}</strong> / ${menu.kapasite}</span>
      </div>
    </div>
    <div class="menu-kart-alt">
      ${butonVeDurumHtml}
    </div>
  `;

  return kart;
}

// Porsiyon seçildiğinde kart üzerindeki fiyatı anında günceller
function porsiyonFiyatGuncelle(menuId, yeniFiyat) {
  const fiyatEl = document.getElementById(`menu-fiyat-${menuId}`);
  if (fiyatEl) {
    fiyatEl.textContent = `${yeniFiyat} TL`;
  }
}

// Menü kartından rezervasyon yapma (seçili porsiyonu okur)
function menuRezervasyonTikla(menuId) {
  const seciliRadio = document.querySelector(`input[name="porsiyon_${menuId}"]:checked`);
  const porsiyon = seciliRadio ? seciliRadio.value : 'tam';
  rezervasyonYap(menuId, porsiyon);
}

// Rezervasyon Yapma Eylemi
async function rezervasyonYap(menuId, porsiyon = 'tam') {
  if (!durum.kullanici) {
    ekranDegistir('giris');
    return;
  }

  try {
    const sonuc = await apiFetch('/api/rezervasyonlar', {
      method: 'POST',
      body: { menu_id: menuId, porsiyon }
    });

    bildirimGoster(sonuc.mesaj || 'Rezervasyon başarıyla oluşturuldu.', 'basari');
    // Bakiye anında güncellenir!
    bakiyeGuncelle(sonuc.bakiye);

    // Aktif ekranı yeniden yükle
    if (durum.aktifEkran === 'gunluk') gunlukMenuleriYukle();
    if (durum.aktifEkran === 'haftalik') haftalikMenuleriYukle();
  } catch (err) {
    // Stored procedure hatası (örn. "Kahvaltıda yarım porsiyon seçilemez." veya "Bakiye yetersiz.") apiFetch tarafından toast olarak basıldı
  }
}

// =====================================================================
// 4. EKRAN: REZERVASYONLARIM
// =====================================================================

async function rezervasyonlariYukle() {
  const alan = document.getElementById('rezervasyonlar-listesi');
  if (!alan) return;

  alan.innerHTML = '<p class="bildirim bildirim-bilgi">Rezervasyonlarınız yükleniyor...</p>';

  try {
    const rezervasyonlar = await apiFetch('/api/rezervasyonlar');
    if (!rezervasyonlar || rezervasyonlar.length === 0) {
      alan.innerHTML = '<p class="bildirim bildirim-bilgi">Henüz kayıtlı bir rezervasyonunuz bulunmuyor.</p>';
      return;
    }

    let html = `
      <div class="tablo-kaydir">
        <table class="veri-tablosu">
          <thead>
            <tr>
              <th>Tarih</th>
              <th>Öğün</th>
              <th>Yemekhane</th>
              <th>Porsiyon</th>
              <th>Ücret</th>
              <th>Durum</th>
              <th>İşlem</th>
            </tr>
          </thead>
          <tbody>
    `;

    rezervasyonlar.forEach(r => {
      let durumRozet = '';
      if (r.durum === 'aktif') durumRozet = '<span class="durum-rozet durum-aktif">Aktif</span>';
      else if (r.durum === 'kullanildi') durumRozet = '<span class="durum-rozet durum-kullanildi">Kullanıldı</span>';
      else durumRozet = '<span class="durum-rozet durum-iptal">İptal Edildi</span>';

      const porsiyonRozet = r.porsiyon === 'yarim'
        ? '<span class="porsiyon-rozet porsiyon-yarim">Yarım (%60)</span>'
        : '<span class="porsiyon-rozet porsiyon-tam">Tam</span>';

      let islemHtml = '—';
      // Yalnızca aktif ve son saati geçmemiş olanlar iptal edilebilir
      if (r.durum === 'aktif' && Number(r.son_saat_gecti) === 0) {
        islemHtml = `<button class="dugme dugme-tehlike dugme-kucuk" onclick="rezervasyonIptalEt(${r.id})">İptal Et</button>`;
      } else if (r.durum === 'aktif' && Number(r.son_saat_gecti) === 1) {
        islemHtml = '<span class="form-ipucu">İptal süresi doldu</span>';
      }

      html += `
        <tr>
          <td><strong>${r.tarih}</strong></td>
          <td>${r.ogun}</td>
          <td>${r.yemekhane}</td>
          <td>${porsiyonRozet}</td>
          <td>${r.ucret} TL</td>
          <td>${durumRozet}</td>
          <td>${islemHtml}</td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </div>
    `;

    alan.innerHTML = html;
  } catch (err) {
    alan.innerHTML = '<p class="bildirim bildirim-hata">Rezervasyonlar yüklenemedi.</p>';
  }
}

async function rezervasyonIptalEt(rezervasyonId) {
  if (!confirm('Bu rezervasyonu iptal etmek ve ücreti bakiyenize iade almak istediğinize emin misiniz?')) {
    return;
  }

  try {
    const sonuc = await apiFetch(`/api/rezervasyonlar/${rezervasyonId}`, {
      method: 'DELETE'
    });

    bildirimGoster(`Rezervasyon iptal edildi. İade: ${sonuc.iade} TL`, 'basari');
    // Bakiye anında güncellenir!
    bakiyeGuncelle(sonuc.bakiye);
    rezervasyonlariYukle();
  } catch (err) {
    // Hata mesajı toast olarak gösterilir
  }
}

// =====================================================================
// 5. EKRAN: BAKİYE İŞLEMLERİ VE HAREKET GEÇMİŞİ
// =====================================================================

async function bakiyeEkraniniYukle() {
  const hareketlerAlan = document.getElementById('bakiye-hareketleri-tablosu');
  if (!hareketlerAlan) return;

  try {
    const veri = await apiFetch('/api/bakiye?taze=1');
    bakiyeGuncelle(veri.bakiye);

    if (!veri.hareketler || veri.hareketler.length === 0) {
      hareketlerAlan.innerHTML = '<p class="bildirim bildirim-bilgi">Henüz bir bakiye hareketiniz bulunmuyor.</p>';
      return;
    }

    let html = `
      <div class="tablo-kaydir">
        <table class="veri-tablosu">
          <thead>
            <tr>
              <th>Tarih / Saat</th>
              <th>İşlem Türü</th>
              <th>Tutar</th>
              <th>Açıklama</th>
            </tr>
          </thead>
          <tbody>
    `;

    veri.hareketler.forEach(h => {
      let turEtiket = '';
      let tutarSinifi = '';
      let tutarIsareti = '';

      const sayisalTutar = parseFloat(h.tutar);

      if (h.tur === 'yukleme') {
        turEtiket = 'Bakiye Yükleme';
        tutarSinifi = 'tutar-yukleme';
        tutarIsareti = '+';
      } else if (h.tur === 'iade') {
        turEtiket = 'İade';
        tutarSinifi = 'tutar-iade';
        tutarIsareti = '+';
      } else {
        turEtiket = 'Rezervasyon';
        tutarSinifi = 'tutar-rezervasyon';
        tutarIsareti = '';
      }

      html += `
        <tr>
          <td>${h.olusturma}</td>
          <td><strong>${turEtiket}</strong></td>
          <td class="${tutarSinifi}">${tutarIsareti}${h.tutar} TL</td>
          <td>${h.aciklama || '—'}</td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </div>
    `;

    hareketlerAlan.innerHTML = html;
  } catch (err) {
    hareketlerAlan.innerHTML = '<p class="bildirim bildirim-hata">Bakiye hareketleri yüklenemedi.</p>';
  }
}

async function bakiyeYukleFormu(e) {
  if (e) e.preventDefault();
  const tutarInput = document.getElementById('bakiye-yukle-tutar');
  const tutar = parseFloat(tutarInput.value);

  if (isNaN(tutar)) {
    bildirimGoster('Yükleme tutarı 10 ile 1000 TL arasında olmalıdır.', 'hata');
    return;
  }

  try {
    const sonuc = await apiFetch('/api/bakiye/yukle', {
      method: 'POST',
      body: { tutar }
    });

    bildirimGoster(sonuc.mesaj || 'Bakiye başarıyla yüklendi.', 'basari');
    bakiyeGuncelle(sonuc.bakiye);
    tutarInput.value = '';
    bakiyeEkraniniYukle();
  } catch (err) {
    // Hata mesajı toast olarak gösterilir
  }
}

function hizliTutarEkle(miktar) {
  const tutarInput = document.getElementById('bakiye-yukle-tutar');
  if (tutarInput) {
    tutarInput.value = miktar;
  }
}

// =====================================================================
// 6. EKRAN: DEĞERLENDİRME (YORUM VE PUAN)
// =====================================================================

async function degerlendirmeleriYukle() {
  const alan = document.getElementById('degerlendirme-menuler-alani');
  if (!alan) return;

  alan.innerHTML = '<p class="bildirim bildirim-bilgi">Değerlendirilebilir menüleriniz kontrol ediliyor...</p>';

  try {
    // Yalnızca kullanılmış rezervasyonlar değerlendirilebilir
    const rezervasyonlar = await apiFetch('/api/rezervasyonlar');
    const kullanilmislar = (rezervasyonlar || []).filter(r => r.durum === 'kullanildi');

    if (kullanilmislar.length === 0) {
      alan.innerHTML = '<p class="bildirim bildirim-bilgi">Yalnızca yemekhanede turnikeden geçip kullandığınız menüleri değerlendirebilirsiniz. Henüz kullanılmış rezervasyonunuz bulunmuyor.</p>';
      return;
    }

    alan.innerHTML = '';

    kullanilmislar.forEach(k => {
      const kart = document.createElement('div');
      kart.className = 'kart';

      if (k.puan !== null && k.puan !== undefined) {
        // Daha önce değerlendirilmiş
        const yildizlar = '⭐'.repeat(k.puan);
        kart.innerHTML = `
          <div class="kart-baslik">
            <h3>${k.tarih} · ${k.ogun} (${k.yemekhane})</h3>
            <span class="durum-rozet durum-kullanildi">Değerlendirildi</span>
          </div>
          <p><strong>Verdiğiniz Puan:</strong> ${yildizlar} (${k.puan}/5)</p>
          <p><strong>Yorumunuz:</strong> ${k.yorum ? k.yorum : '<em>(Yorum yazılmadı)</em>'}</p>
        `;
      } else {
        // Henüz değerlendirilmemiş form
        kart.innerHTML = `
          <div class="kart-baslik">
            <h3>${k.tarih} · ${k.ogun} (${k.yemekhane})</h3>
            <span class="durum-rozet durum-aktif">Puanlama Bekliyor</span>
          </div>
          <form onsubmit="degerlendirmeGonder(event, ${k.menu_id})">
            <div class="form-grup">
              <label>Puanınız (1–5):</label>
              <div class="puan-secici" id="puan-secici-${k.menu_id}">
                ${[1,2,3,4,5].map(p => `
                  <button type="button" class="puan-dugme" onclick="puanSec(${k.menu_id}, ${p})">${p} ⭐</button>
                `).join('')}
              </div>
              <input type="hidden" id="puan-deger-${k.menu_id}" value="5">
            </div>
            <div class="form-grup">
              <label for="yorum-${k.menu_id}">Yorumunuz (İsteğe bağlı):</label>
              <textarea id="yorum-${k.menu_id}" rows="2" placeholder="Menüyle ilgili görüşlerinizi belirtebilirsiniz..."></textarea>
            </div>
            <button type="submit" class="dugme dugme-ana">Değerlendirmeyi Gönder</button>
          </form>
        `;
      }

      alan.appendChild(kart);
    });
  } catch (err) {
    alan.innerHTML = '<p class="bildirim bildirim-hata">Değerlendirmeler listelenirken hata oluştu.</p>';
  }
}

function puanSec(menuId, puan) {
  const gizliInput = document.getElementById(`puan-deger-${menuId}`);
  if (gizliInput) gizliInput.value = puan;

  const secici = document.getElementById(`puan-secici-${menuId}`);
  if (secici) {
    const butonlar = secici.querySelectorAll('.puan-dugme');
    butonlar.forEach((btn, index) => {
      if (index + 1 === puan) {
        btn.classList.add('secili');
      } else {
        btn.classList.remove('secili');
      }
    });
  }
}

async function degerlendirmeGonder(e, menuId) {
  if (e) e.preventDefault();
  const puanInput = document.getElementById(`puan-deger-${menuId}`);
  const yorumInput = document.getElementById(`yorum-${menuId}`);

  const puan = parseInt(puanInput?.value || '5', 10);
  const yorum = yorumInput?.value || '';

  try {
    const sonuc = await apiFetch('/api/degerlendirmeler', {
      method: 'POST',
      body: { menu_id: menuId, puan, yorum }
    });

    bildirimGoster(sonuc.mesaj || 'Değerlendirmeniz başarıyla kaydedildi.', 'basari');
    degerlendirmeleriYukle();
  } catch (err) {
    // Hata mesajı toast olarak gösterilir
  }
}

// =====================================================================
// 7. EKRAN: YÖNETİCİ PANELİ (Yalnızca Yönetici Rolü)
// =====================================================================

async function adminPaneliniYukle() {
  if (!durum.kullanici || durum.kullanici.rol !== 'yonetici') {
    bildirimGoster('Bu ekrana erişim yetkiniz bulunmuyor.', 'hata');
    ekranDegistir('gunluk');
    return;
  }

  await Promise.all([
    adminYemekSecenekleriniYukle(),
    adminMenuleriYukle()
  ]);
}

// Çoklu yemek seçimi için yemek listesini kategori bazlı getir
async function adminYemekSecenekleriniYukle() {
  const kapsayici = document.getElementById('admin-yemek-secimi-alani');
  if (!kapsayici) return;

  try {
    const yemekler = await apiFetch('/api/admin/yemekler');
    if (!yemekler || yemekler.length === 0) {
      kapsayici.innerHTML = '<p class="form-ipucu">Kayıtlı yemek bulunamadı.</p>';
      return;
    }

    kapsayici.innerHTML = yemekler.map(y => `
      <label class="yemek-secim-oge">
        <input type="checkbox" name="admin_yemek_id" value="${y.id}">
        <span>${y.ad} (${y.kategori} · ${y.kalori} kcal)</span>
      </label>
    `).join('');
  } catch (err) {
    console.error('Admin yemekleri yüklenemedi:', err);
  }
}

// Menü Doluluk ve Ortalama Puan Raporu
async function adminMenuleriYukle() {
  const alan = document.getElementById('admin-menu-rapor-tablosu');
  if (!alan) return;

  alan.innerHTML = '<p class="bildirim bildirim-bilgi">Menü raporları yükleniyor...</p>';

  const yemekhaneId = document.getElementById('admin-rapor-yemekhane')?.value || '';
  const baslangic = document.getElementById('admin-rapor-baslangic')?.value || '';

  let url = '/api/admin/menuler?';
  const params = [];
  if (yemekhaneId) params.push(`yemekhane_id=${yemekhaneId}`);
  if (baslangic) params.push(`baslangic=${baslangic}`);
  url += params.join('&');

  try {
    const menuler = await apiFetch(url);
    if (!menuler || menuler.length === 0) {
      alan.innerHTML = '<p class="bildirim bildirim-bilgi">Kayıtlı menü bulunamadı.</p>';
      return;
    }

    let html = `
      <div class="tablo-kaydir">
        <table class="veri-tablosu">
          <thead>
            <tr>
              <th>ID</th>
              <th>Tarih</th>
              <th>Yemekhane / Öğün</th>
              <th>Fiyatlar (Öğr / Per)</th>
              <th>Kapasite / Rezerve / Boş</th>
              <th>Doluluk Oranı</th>
              <th>Puan</th>
              <th>İşlem</th>
            </tr>
          </thead>
          <tbody>
    `;

    menuler.forEach(m => {
      const dolulukYuzde = parseFloat(m.doluluk_yuzde) || 0;
      let dolguSinifi = '';
      if (dolulukYuzde >= 100) dolguSinifi = 'dolu';
      else if (dolulukYuzde >= 75) dolguSinifi = 'uyari';

      const puanGosterim = (m.ortalama_puan !== null && m.ortalama_puan !== undefined)
        ? `⭐ <strong>${m.ortalama_puan}</strong> (${m.oy_sayisi} oy)`
        : '<em>Oy yok</em>';

      html += `
        <tr>
          <td>#${m.menu_id}</td>
          <td><strong>${m.tarih}</strong></td>
          <td>${m.yemekhane} <br><small class="metin-soluk">${m.ogun}</small></td>
          <td>${m.ogrenci_fiyati} TL / ${m.personel_fiyati} TL</td>
          <td>${m.kapasite} / ${m.rezerve} / <strong>${m.bos_yer}</strong></td>
          <td>
            <div style="min-width: 110px;">
              <span>%${m.doluluk_yuzde}</span>
              <div class="ilerleme-bari">
                <div class="ilerleme-dolgu ${dolguSinifi}" style="width: ${Math.min(dolulukYuzde, 100)}%;"></div>
              </div>
            </div>
          </td>
          <td>${puanGosterim}</td>
          <td>
            <button class="dugme dugme-ikincil dugme-kucuk" onclick="adminMenuDuzenleModu(${m.menu_id}, '${m.tarih}', ${m.yemekhane_id}, ${m.ogun_id}, '${m.ogrenci_fiyati}', '${m.personel_fiyati}')">Düzenle</button>
          </td>
        </tr>
      `;
    });

    html += `
          </tbody>
        </table>
      </div>
    `;

    alan.innerHTML = html;
  } catch (err) {
    alan.innerHTML = '<p class="bildirim bildirim-hata">Menü raporları yüklenirken hata oluştu.</p>';
  }
}

// Menü Düzenleme Modunu Aç
function adminMenuDuzenleModu(menuId, tarih, yemekhaneId, ogunId, ogrFiyat, perFiyat) {
  durum.adminDuzenlemeId = menuId;

  document.getElementById('admin-form-baslik').textContent = `Menüyü Güncelle (ID: #${menuId})`;
  document.getElementById('admin-menu-tarih').value = tarih;
  document.getElementById('admin-menu-yemekhane').value = yemekhaneId;
  document.getElementById('admin-menu-ogun').value = ogunId;
  document.getElementById('admin-menu-ogrenci-fiyat').value = ogrFiyat;
  document.getElementById('admin-menu-personel-fiyat').value = perFiyat;

  document.getElementById('admin-btn-kaydet').textContent = 'Güncellemeyi Kaydet';
  document.getElementById('admin-btn-vazgec').style.display = 'inline-flex';

  // Formun olduğu bölüme kaydır
  document.getElementById('admin-form-kapsayici')?.scrollIntoView({ behavior: 'smooth' });
}

// Düzenleme modundan çık / Formu sıfırla
function adminFormuSifirla() {
  durum.adminDuzenlemeId = null;
  document.getElementById('admin-form-baslik').textContent = 'Yeni Menü Oluştur';
  document.getElementById('admin-menu-formu').reset();
  document.getElementById('admin-btn-kaydet').textContent = 'Menüyü Oluştur';
  document.getElementById('admin-btn-vazgec').style.display = 'none';

  // Checkbox'ları temizle
  document.querySelectorAll('input[name="admin_yemek_id"]').forEach(cb => cb.checked = false);
}

// Yeni Menü Ekle veya Güncelle Kaydet
async function adminMenuKaydet(e) {
  if (e) e.preventDefault();

  const tarih = document.getElementById('admin-menu-tarih').value;
  const yemekhane_id = parseInt(document.getElementById('admin-menu-yemekhane').value, 10);
  const ogun_id = parseInt(document.getElementById('admin-menu-ogun').value, 10);
  const ogrenci_fiyati = parseFloat(document.getElementById('admin-menu-ogrenci-fiyat').value);
  const personel_fiyati = parseFloat(document.getElementById('admin-menu-personel-fiyat').value);

  const seciliYemekler = [];
  document.querySelectorAll('input[name="admin_yemek_id"]:checked').forEach(cb => {
    seciliYemekler.push(parseInt(cb.value, 10));
  });

  if (!tarih || !yemekhane_id || !ogun_id || isNaN(ogrenci_fiyati) || isNaN(personel_fiyati)) {
    bildirimGoster('Lütfen menü bilgilerini eksiksiz doldurun.', 'hata');
    return;
  }

  const gonderilecekVeri = {
    yemekhane_id,
    tarih,
    ogun_id,
    ogrenci_fiyati,
    personel_fiyati,
    yemek_ids: seciliYemekler
  };

  try {
    if (durum.adminDuzenlemeId) {
      // Güncelleme: PUT /api/admin/menuler/:id
      const sonuc = await apiFetch(`/api/admin/menuler/${durum.adminDuzenlemeId}`, {
        method: 'PUT',
        body: gonderilecekVeri
      });
      bildirimGoster(sonuc.mesaj || 'Menü başarıyla güncellendi.', 'basari');
    } else {
      // Yeni Menü: POST /api/admin/menuler
      const sonuc = await apiFetch('/api/admin/menuler', {
        method: 'POST',
        body: gonderilecekVeri
      });
      bildirimGoster(sonuc.mesaj || 'Menü başarıyla oluşturuldu.', 'basari');
    }

    adminFormuSifirla();
    adminMenuleriYukle();
  } catch (err) {
    // Hata mesajı toast olarak gösterilir
  }
}

// =====================================================================
// 8. EKRAN: PROFİL VE ALERJEN TERCİHLERİ
// =====================================================================

async function profilEkraniniYukle() {
  if (!durum.kullanici) {
    ekranDegistir('giris');
    return;
  }

  // 1. Profil bilgilerini doldur
  const adSoyadEl = document.getElementById('profil-ad-soyad');
  const epostaEl = document.getElementById('profil-eposta');
  const rolEl = document.getElementById('profil-rol');
  const ogrNoEl = document.getElementById('profil-ogrenci-no');

  if (adSoyadEl) adSoyadEl.textContent = `${durum.kullanici.ad} ${durum.kullanici.soyad}`;
  if (epostaEl) epostaEl.textContent = durum.kullanici.eposta;
  if (rolEl) {
    let rolBaslik = durum.kullanici.rol === 'ogrenci' ? 'Öğrenci' : (durum.kullanici.rol === 'personel' ? 'Personel' : 'Yönetici');
    rolEl.textContent = rolBaslik;
  }
  if (ogrNoEl) {
    ogrNoEl.textContent = durum.kullanici.ogrenci_no || '—';
  }

  // 2. Alerjenleri listele
  const listeKapsayici = document.getElementById('profil-alerjen-listesi');
  if (!listeKapsayici) return;

  listeKapsayici.innerHTML = '<p class="bildirim bildirim-bilgi">Alerjen seçenekleri yükleniyor...</p>';

  try {
    const [tumAlerjenler, kullaniciAlerjenVerisi] = await Promise.all([
      apiFetch('/api/alerjenler'),
      apiFetch('/api/profil/alerjenler')
    ]);

    const kullaniciSecimleri = new Set(
      kullaniciAlerjenVerisi && Array.isArray(kullaniciAlerjenVerisi.alerjen_ids)
        ? kullaniciAlerjenVerisi.alerjen_ids
        : []
    );

    if (!tumAlerjenler || tumAlerjenler.length === 0) {
      listeKapsayici.innerHTML = '<p class="bildirim bildirim-bilgi">Tanımlı alerjen bulunamadı.</p>';
      return;
    }

    listeKapsayici.innerHTML = tumAlerjenler.map(a => {
      const seciliMi = kullaniciSecimleri.has(a.id) ? 'checked' : '';
      return `
        <label class="alerjen-kutu-etiket">
          <input type="checkbox" class="profil-alerjen-cb" value="${a.id}" ${seciliMi}>
          <span>${a.ad}</span>
        </label>
      `;
    }).join('');
  } catch (err) {
    listeKapsayici.innerHTML = '<p class="bildirim bildirim-hata">Alerjenler yüklenemedi.</p>';
  }
}

async function profilAlerjenleriKaydet(event) {
  if (event) event.preventDefault();
  if (!durum.kullanici) return;

  const seciliKutular = document.querySelectorAll('.profil-alerjen-cb:checked');
  const alerjen_ids = Array.from(seciliKutular).map(cb => parseInt(cb.value, 10));

  try {
    const yanit = await apiFetch('/api/profil/alerjenler', {
      method: 'PUT',
      body: { alerjen_ids }
    });

    bildirimGoster(yanit.mesaj || 'Alerjen tercihleriniz başarıyla güncellendi.', 'basari');
  } catch (err) {
    // Hata mesajı toast olarak gösterilir
  }
}
