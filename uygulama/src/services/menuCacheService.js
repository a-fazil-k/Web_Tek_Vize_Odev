const redis = require('../config/redis');

// Tarihi YYYY-MM-DD formatına getiren yardımcı
function formatTarih(tarih) {
  if (!tarih) return '';
  if (tarih instanceof Date) {
    const year = tarih.getFullYear();
    const month = String(tarih.getMonth() + 1).padStart(2, '0');
    const day = String(tarih.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return String(tarih).substring(0, 10);
}

// Anahtar formatı: menu:{yemekhane_id}:{tarih}:{ogun_id}
function menuKeyUret(yemekhaneId, tarih, ogunId) {
  const tarihStr = formatTarih(tarih);
  return `menu:${yemekhaneId}:${tarihStr}:${ogunId}`;
}

// TTL hesaplaması: İlgili menü tarihinin gün sonuna (23:59:59 Europe/Istanbul UTC+3) kalan saniye
function gunSonuTTLHesapla(tarih) {
  const tarihStr = formatTarih(tarih);
  if (!tarihStr) return 0;

  // Istanbul saati UTC+3
  const gunSonu = new Date(`${tarihStr}T23:59:59+03:00`).getTime();
  const simdi = Date.now();
  const kalanSaniye = Math.floor((gunSonu - simdi) / 1000);

  return kalanSaniye > 0 ? kalanSaniye : 0;
}

// Redis'ten menü içeriğini okur
async function menuCacheGet(yemekhaneId, tarih, ogunId) {
  const key = menuKeyUret(yemekhaneId, tarih, ogunId);
  try {
    const raw = await redis.get(key);
    if (!raw) return null;

    console.log(`[REDIS CACHE HIT] ${key} -> Redis onbelleginden sunuldu`);
    return JSON.parse(raw);
  } catch (err) {
    console.error(`[REDIS CACHE HATA] ${key} okunamadi:`, err.message);
    return null;
  }
}

// Menü içeriğini Redis'e gün sonu TTL ile yazar
async function menuCacheSet(yemekhaneId, tarih, ogunId, menuIcerik) {
  const key = menuKeyUret(yemekhaneId, tarih, ogunId);
  const ttl = gunSonuTTLHesapla(tarih);

  // Geçmiş tarihli menü ise (kalan süre <= 0) Redis'e yazma
  if (ttl <= 0) {
    return false;
  }

  try {
    await redis.set(key, JSON.stringify(menuIcerik), 'EX', ttl);
    console.log(`[REDIS CACHE MISS] ${key} -> MySQL replikadan okundu ve Redis'e yazildi (TTL: ${ttl}s)`);
    return true;
  } catch (err) {
    console.error(`[REDIS CACHE HATA] ${key} yazilamadi:`, err.message);
    return false;
  }
}

// Menü önbelleğini geçersizleştirir (silme)
async function menuCacheInvalidate(yemekhaneId, tarih, ogunId) {
  const key = menuKeyUret(yemekhaneId, tarih, ogunId);
  try {
    await redis.del(key);
    console.log(`[REDIS CACHE INVALIDATE] ${key} -> Yonetici guncellemesi nedeniyle silindi`);
  } catch (err) {
    console.error(`[REDIS CACHE HATA] ${key} silinemedi:`, err.message);
  }
}

module.exports = {
  menuKeyUret,
  gunSonuTTLHesapla,
  menuCacheGet,
  menuCacheSet,
  menuCacheInvalidate
};
