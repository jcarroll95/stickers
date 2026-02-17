// Routes for user authorization functions
const express = require('express');
const rateLimit = require('express-rate-limit');
const {
    register,
    login,
    getMe,
    forgotPassword,
    resetPassword,
    updateDetails,
    updatePassword,
    logout,
    registerStart,
    registerVerify,
    registerResend,
    renderResetPasswordForm
} = require('../controllers/auth');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Lightweight per-route rate limiters (complement global limits)
const registerStartLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false });
const registerVerifyLimiter = rateLimit({ windowMs: 60 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });
const registerResendLimiter = rateLimit({ windowMs: 30 * 60 * 1000, max: 3, standardHeaders: true, legacyHeaders: false });

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);  // protect middleware will check for token and validate it
router.post('/forgotPassword', forgotPassword);
router.put('/resetPassword/:resettoken', resetPassword);
router.put('/updatedetails', protect, updateDetails);
router.put('/updatepassword', protect, updatePassword);
router.get('/logout', logout);
router.get('/resetpassword/:resettoken', renderResetPasswordForm);

// New public registration flow
router.post('/register-start', registerStartLimiter, registerStart);
router.post('/register-verify', registerVerifyLimiter, registerVerify);
router.post('/register-resend', registerResendLimiter, registerResend);
module.exports = router;
