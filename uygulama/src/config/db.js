const mysql = require('mysql2/promise');

const dbConfig = {
  port: process.env.DB_PORT ? parseInt(process.env.DB_PORT, 10) : 3306,
  database: process.env.DB_ADI || 'yemekhane',
  user: process.env.DB_KULLANICI || 'yemekhane_app',
  password: process.env.DB_SIFRE || 'Uyg_2026',
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  timezone: '+03:00',
  dateStrings: true
};

// Yazma havuzu (mysql-primary)
const primaryPool = mysql.createPool({
  ...dbConfig,
  host: process.env.DB_YAZMA_HOST || 'mysql-primary'
});

// Okuma havuzu (mysql-replica)
const replicaPool = mysql.createPool({
  ...dbConfig,
  host: process.env.DB_OKUMA_HOST || 'mysql-replica'
});

module.exports = {
  primaryPool,
  replicaPool
};
