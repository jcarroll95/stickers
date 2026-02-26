// /config/redis.js
const redis = require('redis');

const client = redis.createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

client.on('error', (err) => {
  if (process.env.NODE_ENV !== 'test') {
    console.error('Redis Client Error', err);
  }
});
client.on('connect', () => {
  if (process.env.NODE_ENV !== 'test') {
    console.log('Connected to Redis...');
  }
});

// For tests, we'll mock the missing methods if the connection fails or skip entirely.
(async () => {
  if (process.env.NODE_ENV === 'test') {
    client.isOpen = false;
    client.get = async () => null;
    client.set = async () => 'OK';
    client.del = async () => 1;
    client.connect = async () => true;
    return;
  }
  try {
    await client.connect();
  } catch (err) {
    console.error('Failed to connect to Redis on startup', err);
  }
})();

module.exports = client;
