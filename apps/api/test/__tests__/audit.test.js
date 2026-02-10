const { emitAuditEvent } = require('../../utils/audit');
const AuditEvent = require('../../models/AuditEvent');

jest.mock('../../models/AuditEvent');

describe('audit util', () => {
  test('emitAuditEvent should create an AuditEvent with request context', async () => {
    const req = {
      user: { _id: 'user123' },
      id: 'req_abc',
      ip: '127.0.0.1',
      headers: { 'user-agent': 'Jest' },
    };
    const event = {
      entityType: 'StickerPack',
      entityId: 'pack1',
      action: 'pack.update',
      changes: [],
    };

    await emitAuditEvent(req, event);

    expect(AuditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      ...event,
      actorUserId: 'user123',
      actorType: 'user',
      requestId: 'req_abc',
      ip: '127.0.0.1',
      userAgent: 'Jest',
    }));
  });

  test('emitAuditEvent should handle system actor when user is missing', async () => {
    const req = {
      headers: {},
    };
    const event = { action: 'system.event' };

    await emitAuditEvent(req, event);

    expect(AuditEvent.create).toHaveBeenCalledWith(expect.objectContaining({
      actorType: 'system',
      actorUserId: undefined,
    }));
  });
});
