function handleDatabaseError(err, res) {
  // Stored procedure SIGNAL SQLSTATE '45000' (MySQL errno 1644)
  if (err.errno === 1644 || err.sqlState === '45000') {
    return res.status(400).json({ hata: err.sqlMessage || err.message });
  }

  // CHECK constraint violation (MySQL errno 3819)
  if (err.errno === 3819) {
    return res.status(400).json({ hata: 'Geçersiz veri kısıtı ihlali.' });
  }

  // Duplicate entry (MySQL errno 1062)
  if (err.errno === 1062) {
    return res.status(400).json({ hata: 'Bu kayıt zaten mevcut.' });
  }

  console.error('Beklenmeyen Veritabanı Hatası:', err);
  return res.status(500).json({ hata: 'Sunucu hatası oluştu.' });
}

module.exports = {
  handleDatabaseError
};
