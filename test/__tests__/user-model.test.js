const mongoose = require('mongoose');
const User = require('../../models/User');

describe('User model methods', () => {
  test('getSignedJwtToken returns a token and matchPassword true/false works', async () => {
    const user = await User.create({
      name: 'ModelUser',
      email: `modeluser-${Date.now()}@example.com`,
      password: 'Pass123!',
      role: 'user'
    });

    const token = user.getSignedJwtToken();
    expect(typeof token).toBe('string');

    // Need password selected to compare; refetch with +password
    const withPw = await User.findById(user._id).select('+password');
    await expect(withPw.matchPassword('Pass123!')).resolves.toBe(true);
    await expect(withPw.matchPassword('Wrong!')).resolves.toBe(false);
  });

  test('getResetPasswordToken sets token and expiry on user', async () => {
    const user = await User.create({
      name: 'ResetUser',
      email: `resetuser-${Date.now()}@example.com`,
      password: 'Pass123!',
      role: 'user'
    });

    const raw = user.getResetPasswordToken();
    expect(typeof raw).toBe('string');
    await user.save({ validateBeforeSave: false });

    const fresh = await User.findById(user._id).select('+password');
    expect(fresh.resetPasswordToken).toBeTruthy();
    expect(fresh.resetPasswordExpire instanceof Date).toBe(true);
  });
});
