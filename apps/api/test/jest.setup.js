const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongo;

beforeAll(async () => {
  try {
    mongo = await MongoMemoryServer.create({
      replSet: { count: 1 }
    });
    const uri = mongo.getUri();
    await mongoose.connect(uri, { dbName: 'stickers_test' });
  } catch (err) {
    console.error('MongoMemoryServer startup failed:', err);
    if (mongo) await mongo.stop();
    throw err;
  }
});

afterEach(async () => {
  // Safety check: ensure we are NOT connected to a production/Atlas database before wiping
  const host = mongoose.connection.host;
  const isLocal = host && (host === '127.0.0.1' || host === 'localhost' || host.includes('mem'));
  const isAtlas = host && host.includes('mongodb.net');

  if (isLocal && !isAtlas) {
    const collections = await mongoose.connection.db.collections();
    for (const c of collections) {
      await c.deleteMany({});
    }
  } else {
    console.warn(`[SAFETY] Prevented accidental deletion on non-local host: ${host}`);
  }
});

afterAll(async () => {
  await mongoose.disconnect();
  if (mongo) await mongo.stop();
});

// Mock nodemailer so sendEmail() doesn't really send
jest.mock('nodemailer', () => ({
  createTransport: () => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: 'test' }),
    close: jest.fn() // Prevent open handles
  })
}));

// Silence/neutralize noisy middlewares in test
jest.mock('express-rate-limit', () => () => (req, res, next) => next());
jest.mock('express-fileupload', () => () => (req, res, next) => next());
