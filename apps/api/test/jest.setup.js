const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongo;

beforeAll(async () => {
  jest.setTimeout(60000);
  console.log('beforeAll: Starting MongoMemoryServer...');
  try {
    mongo = await MongoMemoryServer.create();
    const uri = mongo.getUri();
    console.log('beforeAll: MongoMemoryServer URI:', uri);
    await mongoose.connect(uri, { dbName: 'stickers_test' });
    console.log('beforeAll: Mongoose connected');
  } catch (err) {
    console.error('beforeAll: MongoMemoryServer startup failed:', err);
    if (mongo) await mongo.stop();
    throw err;
  }
});

afterEach(async () => {
  // Only wipe DB when running tests against mongodb-memory-server.
  if (process.env.NODE_ENV !== 'test' || !mongo) {
    console.warn('[SAFETY] Skipping DB cleanup (not in test env or mongo not initialized).');
    return;
  }

  const collections = await mongoose.connection.db.collections();
  for (const c of collections) {
    await c.deleteMany({});
  }
});

afterAll(async () => {
  try {
    // Force-close sockets; more reliable than disconnect() under replSet.
    await mongoose.connection.close(true);
  } finally {
    if (mongo) {
      await mongo.stop();
      mongo = null;
    }
  }
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

// Mock Redis client to avoid open handles and connection issues in test
jest.mock('../config/redis', () => ({
  isOpen: false,
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  connect: jest.fn().mockResolvedValue(true)
}));
