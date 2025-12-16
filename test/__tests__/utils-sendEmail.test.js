const sendEmail = require('../../utils/sendEmail');

describe('utils/sendEmail', () => {
  test('sends email via mocked transport', async () => {
    await expect(
      sendEmail({
        email: 't@example.com',
        subject: 'Hi',
        message: 'Hello world'
      })
    ).resolves.toBeUndefined();
  });
});
