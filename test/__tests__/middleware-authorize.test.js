const express = require('express');
const request = require('supertest');
const { authorize } = require('../../middleware/auth');

// Build a tiny throwaway app to exercise authorize() without needing full auth
function buildAppWithRole(role, rolesAllowed) {
  const app = express();
  // Inject a fake user onto req before authorize runs
  app.use((req, res, next) => {
    req.user = { role };
    next();
  });
  app.get('/guarded', authorize(...rolesAllowed), (req, res) => {
    res.status(200).json({ ok: true });
  });
  // Error handler to normalize ErrorResponse outputs during test
  app.use((err, req, res, next) => {
    const status = err.statusCode || 500;
    res.status(status).json({ success: false, error: err.message });
  });
  return app;
}

describe('middleware/authorize', () => {
  test('denies when role is not permitted (403)', async () => {
    const app = buildAppWithRole('user', ['admin']);
    const res = await request(app).get('/guarded').expect(403);
    expect(res.body.success).toBe(false);
    expect(String(res.body.error || '')).toMatch(/not authorized/i);
  });

  test('allows when role is permitted (200)', async () => {
    const app = buildAppWithRole('vipuser', ['vipuser', 'admin']);
    const res = await request(app).get('/guarded').expect(200);
    expect(res.body.ok).toBe(true);
  });
});
