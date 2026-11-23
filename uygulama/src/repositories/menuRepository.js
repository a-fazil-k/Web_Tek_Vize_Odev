const { primaryPool, replicaPool } = require('../config/db');

// Tarihe veya tarih aralığına ve yemekhaneye göre detaylı menüleri view'lardan çeker
async function getMenuDetayRows({ baslangic, bitis, yemekhane_id } = {}) {
  let query = `
    SELECT 
      d.menu_id, d.tarih, d.yemekhane_id, d.yemekhane, d.ogun_id, d.ogun, d.ogun_sira,
      d.rezervasyon_son, d.ogrenci_fiyati, d.personel_fiyati,
      d.yemek_id, d.yemek, d.kategori_id, d.kategori, d.kategori_sira,
      d.kalori, d.vejetaryen, d.alerjenler, d.alerjen_idler,
      dol.kapasite, dol.rezerve, dol.bos_yer, dol.doluluk_yuzde,
      p.oy_sayisi, p.ortalama_puan
    FROM v_menu_detay d
    JOIN v_menu_doluluk dol ON dol.menu_id = d.menu_id
    LEFT JOIN v_menu_puan p ON p.menu_id = d.menu_id
    WHERE 1=1
  `;
  const params = [];

  if (baslangic && bitis) {
    query += ' AND d.tarih BETWEEN ? AND ?';
    params.push(baslangic, bitis);
  } else if (baslangic) {
    query += ' AND d.tarih = ?';
    params.push(baslangic);
  }

  if (yemekhane_id) {
    query += ' AND d.yemekhane_id = ?';
    params.push(yemekhane_id);
  }

  query += ' ORDER BY d.tarih ASC, d.ogun_sira ASC, d.kategori_sira ASC, d.yemek ASC';

  const [rows] = await replicaPool.query(query, params);
  return rows;
}

// Tek bir menüyü ID ile detaylarıyla view'lardan çeker
async function findMenuById(menuId) {
  const query = `
    SELECT 
      d.menu_id, d.tarih, d.yemekhane_id, d.yemekhane, d.ogun_id, d.ogun, d.ogun_sira,
      d.rezervasyon_son, d.ogrenci_fiyati, d.personel_fiyati,
      d.yemek_id, d.yemek, d.kategori_id, d.kategori, d.kategori_sira,
      d.kalori, d.vejetaryen, d.alerjenler, d.alerjen_idler,
      dol.kapasite, dol.rezerve, dol.bos_yer, dol.doluluk_yuzde,
      p.oy_sayisi, p.ortalama_puan
    FROM v_menu_detay d
    JOIN v_menu_doluluk dol ON dol.menu_id = d.menu_id
    LEFT JOIN v_menu_puan p ON p.menu_id = d.menu_id
    WHERE d.menu_id = ?
    ORDER BY d.kategori_sira ASC, d.yemek ASC
  `;
  const [rows] = await replicaPool.query(query, [menuId]);
  return rows;
}

// Yönetici menü listesi
async function getAdminMenuler({ baslangic, bitis, yemekhane_id } = {}) {
  let query = `
    SELECT 
      m.id AS menu_id, m.tarih, m.yemekhane_id, yh.ad AS yemekhane,
      m.ogun_id, o.ad AS ogun, o.sira AS ogun_sira,
      m.ogrenci_fiyati, m.personel_fiyati,
      dol.kapasite, dol.rezerve, dol.bos_yer, dol.doluluk_yuzde, dol.rezervasyon_son,
      p.oy_sayisi, p.ortalama_puan
    FROM menuler m
    JOIN yemekhaneler yh ON yh.id = m.yemekhane_id
    JOIN ogunler o ON o.id = m.ogun_id
    LEFT JOIN v_menu_doluluk dol ON dol.menu_id = m.id
    LEFT JOIN v_menu_puan p ON p.menu_id = m.id
    WHERE 1=1
  `;
  const params = [];

  if (baslangic && bitis) {
    query += ' AND m.tarih BETWEEN ? AND ?';
    params.push(baslangic, bitis);
  } else if (baslangic) {
    query += ' AND m.tarih >= ?';
    params.push(baslangic);
  }

  if (yemekhane_id) {
    query += ' AND m.yemekhane_id = ?';
    params.push(yemekhane_id);
  }

  query += ' ORDER BY m.tarih DESC, o.sira ASC';

  const [rows] = await replicaPool.query(query, params);
  return rows;
}

// Menüye ait yemekleri getirir
async function getMenuYemekleri(menuIds) {
  if (!menuIds || menuIds.length === 0) return [];
  const [rows] = await replicaPool.query(
    `SELECT 
       my.menu_id, y.id AS yemek_id, y.ad AS yemek, y.kalori, y.vejetaryen,
       k.id AS kategori_id, k.ad AS kategori, k.sira AS kategori_sira
     FROM menu_yemekleri my
     JOIN yemekler y ON y.id = my.yemek_id
     JOIN yemek_kategorileri k ON k.id = y.kategori_id
     WHERE my.menu_id IN (?)
     ORDER BY my.menu_id, k.sira ASC, y.ad ASC`,
    [menuIds]
  );
  return rows;
}

// Tüm yemeklerin listesi (admin için)
async function getAdminYemekler() {
  const [rows] = await replicaPool.query(`
    SELECT 
      y.id, y.ad, y.kalori, y.vejetaryen,
      k.id AS kategori_id, k.ad AS kategori, k.sira AS kategori_sira,
      (SELECT GROUP_CONCAT(a.ad ORDER BY a.ad SEPARATOR ', ')
         FROM yemek_alerjenleri ya JOIN alerjenler a ON a.id = ya.alerjen_id
        WHERE ya.yemek_id = y.id) AS alerjenler,
      (SELECT GROUP_CONCAT(ya.alerjen_id ORDER BY ya.alerjen_id)
         FROM yemek_alerjenleri ya
        WHERE ya.yemek_id = y.id) AS alerjen_idler
    FROM yemekler y
    JOIN yemek_kategorileri k ON k.id = y.kategori_id
    ORDER BY k.sira ASC, y.ad ASC
  `);
  return rows;
}

// Yeni menü ekleme (Primary Pool üzerinde Transaction ile)
async function createMenu({ yemekhane_id, tarih, ogun_id, ogrenci_fiyati, personel_fiyati, yemek_ids }) {
  const connection = await primaryPool.getConnection();
  try {
    await connection.beginTransaction();

    const [result] = await connection.query(
      `INSERT INTO menuler (yemekhane_id, tarih, ogun_id, ogrenci_fiyati, personel_fiyati)
       VALUES (?, ?, ?, ?, ?)`,
      [yemekhane_id, tarih, ogun_id, ogrenci_fiyati, personel_fiyati]
    );
    const menuId = result.insertId;

    if (Array.isArray(yemek_ids) && yemek_ids.length > 0) {
      const values = yemek_ids.map(yemekId => [menuId, yemekId]);
      await connection.query(
        'INSERT INTO menu_yemekleri (menu_id, yemek_id) VALUES ?',
        [values]
      );
    }

    await connection.commit();
    return menuId;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

// Menü güncelleme (Primary Pool üzerinde Transaction ile)
async function updateMenu(id, { yemekhane_id, tarih, ogun_id, ogrenci_fiyati, personel_fiyati, yemek_ids }) {
  const connection = await primaryPool.getConnection();
  try {
    await connection.beginTransaction();

    // Dinamik alan güncellemesi
    const fields = [];
    const values = [];

    if (yemekhane_id !== undefined) {
      fields.push('yemekhane_id = ?');
      values.push(yemekhane_id);
    }
    if (tarih !== undefined) {
      fields.push('tarih = ?');
      values.push(tarih);
    }
    if (ogun_id !== undefined) {
      fields.push('ogun_id = ?');
      values.push(ogun_id);
    }
    if (ogrenci_fiyati !== undefined) {
      fields.push('ogrenci_fiyati = ?');
      values.push(ogrenci_fiyati);
    }
    if (personel_fiyati !== undefined) {
      fields.push('personel_fiyati = ?');
      values.push(personel_fiyati);
    }

    if (fields.length > 0) {
      values.push(id);
      await connection.query(
        `UPDATE menuler SET ${fields.join(', ')} WHERE id = ?`,
        values
      );
    }

    // Yemek listesi güncellendiyse
    if (Array.isArray(yemek_ids)) {
      await connection.query('DELETE FROM menu_yemekleri WHERE menu_id = ?', [id]);
      if (yemek_ids.length > 0) {
        const yemekValues = yemek_ids.map(yemekId => [id, yemekId]);
        await connection.query(
          'INSERT INTO menu_yemekleri (menu_id, yemek_id) VALUES ?',
          [yemekValues]
        );
      }
    }

    await connection.commit();
    return true;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

module.exports = {
  getMenuDetayRows,
  findMenuById,
  getAdminMenuler,
  getMenuYemekleri,
  getAdminYemekler,
  createMenu,
  updateMenu
};
