// Jest setup: environment variables required by the app during tests
process.env.NODE_ENV = 'test';

// JWT settings
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test_jwt_secret';
process.env.JWT_EXPIRE = process.env.JWT_EXPIRE || '30d';
process.env.JWT_COOKIE_EXPIRE = process.env.JWT_COOKIE_EXPIRE || '30';

// Email settings used by utils/sendEmail
process.env.SMTP_HOST = process.env.SMTP_HOST || 'localhost';
process.env.SMTP_PORT = process.env.SMTP_PORT || '2525';
process.env.SMTP_USER = process.env.SMTP_USER || 'test_user';
process.env.SMTP_PASS = process.env.SMTP_PASS || 'test_pass';
process.env.FROM_NAME = process.env.FROM_NAME || 'Test Sender';
process.env.FROM_EMAIL = process.env.FROM_EMAIL || 'test@example.com';
