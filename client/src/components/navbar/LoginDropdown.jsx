import React from 'react';
import styles from '../Navbar.module.css';

const LoginDropdown = ({ 
    email, 
    setEmail, 
    password, 
    setPassword, 
    loggingIn, 
    loginError, 
    onSubmit 
}) => (
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
        </form>
    </div>
);

export default LoginDropdown;
