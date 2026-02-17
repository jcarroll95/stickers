import React, { useState } from 'react';
import styles from '../Navbar.module.css';
import apiClient from '../../services/apiClient';
import { toast } from 'react-hot-toast';

const LoginDropdown = ({
    email,
    setEmail,
    password,
    setPassword,
    loggingIn,
    loginError,
    onSubmit
}) => {
    const [sendingForgot, setSendingForgot] = useState(false);

    const handleForgotPassword = async (e) => {
        e.preventDefault();

        if (!email) {
            toast.error('Please enter your email address first');
            return;
        }

        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            toast.error('Please enter a valid email address');
            return;
        }

        setSendingForgot(true);
        try {
            await apiClient.post('/auth/forgotpassword', { email });
            toast.success('Password reset email sent!');
        } catch (error) {
            const message = error.response?.data?.error || 'Failed to send reset email';
            toast.error(message);
        } finally {
            setSendingForgot(false);
        }
    };

    return (
        <div id="login-dropdown" className={styles.dropdown}>
            <form className={styles.loginForm} onSubmit={onSubmit}>
                <div className={styles.formRow}>
                    <label className={styles.label} htmlFor="login-email">Email</label>
                    <input
                        id="login-email"
                        type="email"
                        className={styles.input}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@email.com"
                        required
                    />
                </div>
                <div className={styles.formRow}>
                    <label className={styles.label} htmlFor="login-password">Password</label>
                    <input
                        id="login-password"
                        type="password"
                        className={styles.input}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="••••••••"
                        required
                    />
                </div>
                {loginError && (
                    <div className={styles.error}>{loginError}</div>
                )}
                <button
                    type="submit"
                    className={styles.submitButton}
                    disabled={loggingIn}
                >
                    {loggingIn ? 'Signing in…' : 'Submit'}
                </button>
                <div className={styles.forgotPasswordWrapper}>
                    <button
                        type="button"
                        className={styles.forgotPasswordLink}
                        onClick={handleForgotPassword}
                        disabled={sendingForgot}
                    >
                        {sendingForgot ? 'Sending...' : 'Forgot password?'}
                    </button>
                </div>
            </form>
        </div>
    );
};

export default LoginDropdown;
