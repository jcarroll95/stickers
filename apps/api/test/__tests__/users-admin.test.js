const request = require('supertest');
const app = require('../../server');

async function registerAndLogin({ name = 'User', email, password = 'Pass123!', role = 'user' } = {}) {
  const reg = await request(app).post('/api/v1/auth/register').send({ name, email, password, role }).expect(200);
  return reg.body.token;
}

describe('Admin Users routes', () => {
  test('non-admin is forbidden from users endpoints (403)', async () => {
    const token = await registerAndLogin({ email: 'notadmin@example.com' });
    const res = await request(app)
      .get('/api/v1/auth/users')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
    expect(res.body.success).toBe(false);
  });

  test('admin can list, create, update, and delete users', async () => {
    const adminToken = await registerAndLogin({ email: 'admin@example.com', role: 'admin' });

    // list
    const list = await request(app)
      .get('/api/v1/auth/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(list.body.success).toBe(true);

    // create
    const created = await request(app)
      .post('/api/v1/auth/users')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'New User', email: `new-${Date.now()}@example.com`, password: 'Pass123!', role: 'user' })
      .expect(201);
    expect(created.body.success).toBe(true);
    const userId = created.body.data._id;

    // update
    const updated = await request(app)
      .put(`/api/v1/auth/users/${userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Updated User' })
      .expect(200);
    expect(updated.body.success).toBe(true);
    expect(updated.body.data.name).toBe('Updated User');

    // delete
    const deleted = await request(app)
      .delete(`/api/v1/auth/users/${userId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .expect(200);
    expect(deleted.body.success).toBe(true);
    expect(deleted.body.data).toEqual({});
  });
});
