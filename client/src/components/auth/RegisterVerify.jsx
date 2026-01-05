import React, { useEffect, useMemo, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import styles from './RegisterVerify.module.css';
import apiClient from '../../services/apiClient';

import { toast } from 'react-hot-toast';
import { parseError } from '../../utils/errorUtils';

/**
 * RegisterVerify Component
 * Handles the two-step registration flow:
 * 1) Identity details (email, password, name)
 * 2) Email verification via code
 * 
 * @param {Object} props - Component properties
 * @param {Function} [props.onSuccess] - Callback when registration/verification is complete
 * @param {string} [props.mode] - 'verify' to jump straight to code entry
 * @param {string} [props.initialEmail] - Pre-fill email field
 */
export default function RegisterVerify({ onSuccess, mode, initialEmail = '' }) {
  const isVerifyMode = mode === 'verify';
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const inputsRef = useRef([]);

  useEffect(() => {
    let t;
    if (cooldown > 0) {
      t = setTimeout(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    }
    return () => clearTimeout(t);
  }, [cooldown]);

  // Auto-resume from localStorage (same-browser convenience)
  // Keys
  const PENDING_KEY = 'pendingRegistration';

  // On mount, if not in verify route, try to restore step 2 based on persisted metadata
  useEffect(() => {
    if (isVerifyMode) return; // verify mode uses dedicated flow
    try {
      const raw = localStorage.getItem(PENDING_KEY);
      if (!raw) return;
      const data = JSON.parse(raw);
      const now = Date.now();
      if (!data || !data.email || !data.expiresAt || now >= data.expiresAt) {
        localStorage.removeItem(PENDING_KEY);
        return;
      }
      setEmail(data.email || '');
      setStep(2);
      const cd = Math.max(0, Math.floor(((data.cooldownUntil || 0) - now) / 1000));
      setCooldown(cd);
      setMessage(`We found a pending verification for ${data.email}. Enter the code from your email.`);
      // focus code box shortly after paint
      setTimeout(() => inputsRef.current[0]?.focus(), 0);
    } catch (e) {
      console.warn('[RegisterVerify] Failed to restore pending registration:', e);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emailValid = useMemo(() => {
    const e = email.trim();
    // Basic RFC 5322–ish email pattern suitable for UI validation
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);
  }, [email]);

  const nameValid = useMemo(() => name.trim().length > 0, [name]);

  const canSubmitStart = useMemo(() => {
    const passwordsMatch = password.length >= 6 && password === confirm;
    return nameValid && emailValid && passwordsMatch && !loading;
  }, [nameValid, emailValid, password, confirm, loading]);

  const codeStr = useMemo(() => code.join(''), [code]);
  // In verify mode we also require a valid email to be present (email is editable here)
  const canVerify = useMemo(() => {
    const base = codeStr.length === 6 && !loading;
    return isVerifyMode ? base && emailValid : base;
  }, [codeStr, loading, isVerifyMode, emailValid]);

  // UI hints
  const showPasswordLenHint = password.length <= 5; // show until 6+ chars
  const passwordsStrongEnoughAndMatch = password.length >= 6 && confirm.length >= 6 && password === confirm;
  const showPasswordsMustMatchHint = !passwordsStrongEnoughAndMatch; // hide only when both 6+ and equal

  function handleCodeChange(i, val) {
    if (!/^\d?$/.test(val)) return; // allow only single digit
    const next = [...code];
    next[i] = val;
    setCode(next);
    if (val && inputsRef.current[i + 1]) {
      inputsRef.current[i + 1].focus();
    }
  }

  const COOLDOWN_TIME = import.meta.env.MODE === 'test' ? 1 : 60;

  async function startRegister(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      await apiClient.post('/auth/register-start', { 
        email: email.trim().toLowerCase(), 
        password, 
        name 
      });

      setStep(2);
      setMessage('If that email is eligible, a verification code has been sent.');
      setCooldown(COOLDOWN_TIME);
      // Persist pending registration so user can come back
      try {
        const now = Date.now();
        const payload = {
          email: email.trim().toLowerCase(),
          // UI already states 15 minutes expiry
          expiresAt: now + 15 * 60 * 1000,
          cooldownUntil: now + COOLDOWN_TIME * 1000,
        };
        localStorage.setItem(PENDING_KEY, JSON.stringify(payload));
      } catch (e) {
        console.warn('[RegisterVerify] Failed to persist pending registration:', e);
      }
      // focus first code box
      setTimeout(() => inputsRef.current[0]?.focus(), 0);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to start registration');
    } finally {
      setLoading(false);
    }
  }

  async function verifyCode(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const data = await apiClient.post('/auth/register-verify', {
        email: email.trim().toLowerCase(),
        code: codeStr
      });

      if (!data?.success) {
        throw new Error('Invalid or expired code');
      }

      // Clear pending registration on success
      localStorage.removeItem(PENDING_KEY);

      setMessage('Verification successful!');
      if (onSuccess) onSuccess(data);

      // After verification, check if user already has a stickerboard.
      // If not, route to creation page before first board view.
      try {
        // Get current user
        const response = await apiClient.get('/auth/me');
        const userData = response.data || response;
        const uid = userData?._id || userData?.id || null;

        if (uid) {
          const sbResponse = await apiClient.get(`/stickerboards?user=${encodeURIComponent(uid)}&limit=1`);
          const boards = sbResponse.data || sbResponse;
          const board = Array.isArray(boards) ? boards[0] : null;

          if (!board) {
            window.location.hash = '#/board/create';
            return;
          }
          const boardToken = board._id || board.id || board.slug;
          if (boardToken) {
            window.location.hash = `#/board/${boardToken}`;
            return;
          }
        }
        // Fallback
        window.location.hash = '#/board';
      } catch (innerErr) {
        console.error('[RegisterVerify] Error during post-verification routing:', innerErr);
        window.location.hash = '#/board';
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Verification failed');
    } finally {
      setLoading(false);
    }
  }

  async function resendCode(e) {
    e.preventDefault();
    if (cooldown > 0) return;
    setError('');
    setMessage('');
    setLoading(true);
    try {
      await apiClient.post('/auth/register-resend', { 
        email: email.trim().toLowerCase() 
      });

      toast.success('A new code has been sent.');
      setMessage('A new code has been sent.');
      setCooldown(COOLDOWN_TIME);
      // Update persisted cooldown (and optionally extend expiry if your backend resets it)
      try {
        const raw = localStorage.getItem(PENDING_KEY);
        const now = Date.now();
        const payload = raw ? JSON.parse(raw) : {};
        payload.email = email.trim().toLowerCase();
        payload.cooldownUntil = now + COOLDOWN_TIME * 1000;
        // optionally: payload.expiresAt = Math.max(payload.expiresAt || 0, now + 15*60*1000);
        localStorage.setItem(PENDING_KEY, JSON.stringify(payload));
      } catch (e) {
        console.warn('[RegisterVerify] Failed to persist resend metadata:', e);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Unable to resend code');
    } finally {
      setLoading(false);
    }
  }

  // Compute effective step for rendering: verify mode always shows code entry (step 2)
  const effectiveStep = isVerifyMode ? 2 : step;

  return (
    <div className={styles.container}>
      {effectiveStep === 1 && (
        <form onSubmit={startRegister}>
          <h2 className={styles.title}>Create your account</h2>
          <div className={styles.field}>
            <label htmlFor="name" className={styles.label}>Name</label>
            <input id="name" className={styles.input} type="text" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className={styles.field}>
            <label htmlFor="email" className={styles.label}>Email</label>
            <input id="email" className={styles.input} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className={styles.field}>
            <label htmlFor="password" className={styles.label}>Password</label>
            <input id="password" className={styles.input} type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            {showPasswordLenHint && (
              <div className={styles.hint}>At least 6 characters</div>
            )}
          </div>
          <div className={styles.field}>
            <label htmlFor="confirm" className={styles.label}>Confirm password</label>
            <input id="confirm" className={styles.input} type="password" required minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            {showPasswordsMustMatchHint && (
              <div className={styles.hint}>Passwords must match</div>
            )}
          </div>
          {error && <div className={styles.error} role="alert">{error}</div>}
          {message && <div className={styles.message}>{message}</div>}
          <div className={styles.actions}>
            <button
              className={`${styles.buttonPrimary} ${canSubmitStart && !loading ? styles.buttonPrimaryReady : ''}`}
              type="submit"
              disabled={!canSubmitStart || loading}
            >
              {loading ? 'Submitting…' : 'Continue'}
            </button>
          </div>
          <div className={styles.hint}>
            Already registered?{' '}
            <a href="#/register/verify">Enter a registration code</a>
          </div>
        </form>
      )}

      {effectiveStep === 2 && (
        <form onSubmit={verifyCode}>
          <div className={styles.header}>
            <h2 className={styles.title}>Enter verification code</h2>
            {!isVerifyMode && (
              <button
                className={styles.linkButton}
                onClick={(e) => {
                  e.preventDefault();
                  try { localStorage.removeItem(PENDING_KEY); } catch (err) {
                    console.warn('[RegisterVerify] Failed to remove pending key:', err);
                  }
                  setStep(1);
                }}
              >
                Change email
              </button>
            )}
          </div>
          {isVerifyMode ? (
            <>
              <div className={styles.field}>
                <label htmlFor="verify-email" className={styles.label}>Email</label>
                <input
                  id="verify-email"
                  className={styles.input}
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className={styles.hint}>Enter the 6‑digit code sent to your email. It expires in 15 minutes.</div>
            </>
          ) : (
            <div className={styles.hint}>We sent a 6‑digit code to {email}. It expires in 15 minutes.</div>
          )}
          <div className={styles.spacer} />
          <div className={styles.codeGrid}>
            {code.map((c, i) => (
              <input
                key={i}
                ref={(el) => inputsRef.current[i] = el}
                className={`${styles.input} ${styles.codeInput}`}
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                value={c}
                onChange={(e) => handleCodeChange(i, e.target.value.replace(/\D/g, ''))}
              />
            ))}
          </div>
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.buttonSecondary}
              onClick={resendCode}
              disabled={cooldown > 0 || loading || (isVerifyMode && !emailValid)}
              aria-label="Resend code"
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
            </button>
            <button className={styles.buttonPrimary} type="submit" disabled={!canVerify || loading}>
              {loading ? 'Verifying…' : 'Verify'}
            </button>
          </div>
          {error && <div className={styles.error} role="alert">{error}</div>}
          {message && <div className={`${styles.message} ${!error ? styles.success : ''}`}>{message}</div>}
        </form>
      )}
    </div>
  );
}

RegisterVerify.propTypes = {
  onSuccess: PropTypes.func,
  mode: PropTypes.oneOf(['verify']),
  initialEmail: PropTypes.string,
};
