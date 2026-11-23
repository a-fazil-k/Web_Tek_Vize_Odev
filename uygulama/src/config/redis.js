const Redis = require('ioredis');

const redisConfig = {
  host: process.env.REDIS_HOST || 'redis',
  port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT, 10) : 6379,
  password: process.env.REDIS_SIFRE || process.env.REDIS_PASSWORD || undefined,
  retryStrategy(times) {
    const delay = Math.min(times * 100, 3000);
    return delay;
  },
  maxRetriesPerRequest: 3
};

const redis = new Redis(redisConfig);

redis.on('connect', () => {
  console.log(`[REDIS] Redis sunucusuna (${redisConfig.host}:${redisConfig.port}) baglanti kuruluyor...`);
});

redis.on('ready', () => {
  console.log(`[REDIS] Redis baglantisi basariyla hazir ve dogrulandi.`);
});

redis.on('error', (err) => {
  console.error(`[REDIS HATA] Redis baglanti hatasi:`, err.message);
});

redis.on('close', () => {
  console.log(`[REDIS] Redis baglantisi kapandi.`);
});

module.exports = redis;
