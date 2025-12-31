import React, { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';
import styles from './Navbar.module.css';
import apiClient from '../services/apiClient';
import useAuthStore from '../store/authStore';

/**
 * Navbar Component
 * Primary navigation and authentication control center.
 */
const Navbar = () => {
    const { user, login, logout, initialize } = useAuthStore();
    const [menuOpen, setMenuOpen] = useState(false);
    // unauthenticated login dropdown state
    const [loginOpen, setLoginOpen] = useState(false);
    const [navigatingMyBoard, setNavigatingMyBoard] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loggingIn, setLoggingIn] = useState(false);
    const [loginError, setLoginError] = useState('');
    const loginMenuRef = useRef(null);
    const userMenuRef = useRef(null);

    const handleCreateAccount = () => {
        // Close any open login dropdown and navigate to registration
        setLoginOpen(false);
        window.location.hash = '#/register';
    };

    // Initialize auth state on mount
    useEffect(() => {
        initialize();
    }, [initialize]);

    // Helper to safely extract a user id from various shapes
    const getUserId = (u) => {
        if (!u) return null;
        // If u is the envelope { success: true, data: user }
        const userObj = u.data || u;
        return userObj._id || userObj.id || userObj.__id || null;
    };

    // Navigate to the currently logged-in user's stickerboard
    const handleGoToMyBoard = async () => {
        if (navigatingMyBoard) return;
        setNavigatingMyBoard(true);
        try {
            // Ensure we have the current user, refresh if possible to avoid stale state
            let currentUser = user;
            try {
                const response = await apiClient.get('/auth/me');
                // The interceptor returns response.data (the body)
                // Body is { success: true, data: user }
                currentUser = response?.data || response;
            } catch (e) {
                console.warn('[Navbar] Could not refresh user profile for "My Board":', e.message);
                // If we don't even have a cached user, we must log in
                if (!currentUser) {
                    setLoginOpen(true);
                    return;
                }
            }

            const uid = getUserId(currentUser);
            if (!uid) {
                console.warn('[Navbar] Could not resolve user ID for "My Board"', currentUser);
                setLoginOpen(true);
                return;
            }

            // Fetch this user's stickerboard(s). Limit to first.
            let board = null;
            try {
                const sbResponse = await apiClient.get(`/stickerboards?user=${encodeURIComponent(uid)}&limit=1`);
                // sbResponse is the body { success: true, data: [...] }
                // Use a more robust check for the array
                const boards = sbResponse?.data || (Array.isArray(sbResponse) ? sbResponse : []);
                board = Array.isArray(boards) ? boards[0] : null;
            } catch (sbErr) {
                // If unauthorized, show login
                if (sbErr.response?.status === 401) {
                    setLoginOpen(true);
                } else {
                    console.error('[Navbar] Failed to fetch user boards:', sbErr.message);
                }
                return;
            }

            if (!board) {
                // No board exists yet for user. Route to creation flow.
                window.location.hash = '#/board/create';
                return;
            }

            // Prefer slug route if available, else id. Keep hash-based routing consistent with app.
            const boardToken = board.slug || board._id || board.id;
            if (boardToken) {
                window.location.hash = `#/board/${boardToken}`;
            } else {
                window.location.hash = '#/board';
            }
        } catch (err) {
            console.error('[Navbar] Unexpected error in handleGoToMyBoard:', err);
        } finally {
            setNavigatingMyBoard(false);
        }
    };

    const handleLogout = async () => {
        setMenuOpen(false);
        await logout();
    };

    const handleLoginSubmit = async (e) => {
        e.preventDefault();
        if (loggingIn) return;
        setLoginError('');
        setLoggingIn(true);
        try {
            const data = await apiClient.post('/auth/login', { email, password });

            // Fetch current user to populate menu
            try {
                const response = await apiClient.get('/auth/me');
                const userData = response.data || response;
                
                // Centralized login in store
                login(userData || null);

                // reset form and close dropdown
                setEmail('');
                setPassword('');
                setLoginOpen(false);
            } catch (meErr) {
                console.error('[Navbar] Unable to fetch user profile after login:', meErr);
                // Even if login returned success, if /me fails, treat as error
                throw new Error('Unable to fetch user profile after login');
            }
        } catch (err) {
            setLoginError(err.response?.data?.error || err.message || 'Login failed');
        } finally {
            setLoggingIn(false);
        }
    };

    // Close the unauthenticated login dropdown on outside click or ESC
    useEffect(() => {
        if (!loginOpen) return;

        const onDocMouseDown = (e) => {
            if (!loginMenuRef.current) return;
            if (!loginMenuRef.current.contains(e.target)) {
                setLoginOpen(false);
            }
        };

        const onKeyDown = (e) => {
            if (e.key === 'Escape') {
                setLoginOpen(false);
            }
        };

        document.addEventListener('mousedown', onDocMouseDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('mousedown', onDocMouseDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [loginOpen]);

    // Close the authenticated user dropdown on outside click or ESC
    useEffect(() => {
        if (!menuOpen) return;

        const onDocMouseDown = (e) => {
            if (!userMenuRef.current) return;
            if (!userMenuRef.current.contains(e.target)) {
                setMenuOpen(false);
            }
        };

        const onKeyDown = (e) => {
            if (e.key === 'Escape') {
                setMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', onDocMouseDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('mousedown', onDocMouseDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [menuOpen]);

    return (
        <nav className={styles.nav}>
            <div className={styles.logoContainer} onClick={() => { window.location.hash = '#/'; }}>
                <img
                    src="/assets/stickerboards_star_fixed.png"
                    alt="Stickerboards Logo"
                    className={styles.logoImage}
                />
            </div>

            <ul className={styles.navLinks}>
                <li>
                    <button
                        type="button"
                        className={styles.link}
                        disabled={navigatingMyBoard}
                        onClick={handleGoToMyBoard}
                    >
                        {navigatingMyBoard ? 'My Board…' : 'My Board'}
                    </button>
                </li>
                <li>
                    <button
                        type="button"
                        className={styles.link}
                        onClick={() => { window.location.hash = '#/explore'; }}
                    >
                        Explore
                    </button>
                </li>
                <li className={styles.link}>Cheer!</li>
                <li className={styles.link}>Developer Docs</li>
            </ul>


            <div className={styles.auth}>
                {!user ? (
                    <>
                        <button
                            className={`${styles.button} ${styles.createAccountButton}`}
                            onClick={handleCreateAccount}
                            aria-label="Create Account"
                        >
                            Create Account
                        </button>
                        <div className={styles.userMenu} ref={loginMenuRef}>
                            <button
                                className={`${styles.button} ${styles.loginButton}`}
                                onClick={() => setLoginOpen((v) => !v)}
                                aria-expanded={loginOpen}
                                aria-controls="login-dropdown"
                            >
                                Login
                            </button>
                            {loginOpen && (
                                <div id="login-dropdown" className={styles.dropdown}>
                                    <form className={styles.loginForm} onSubmit={handleLoginSubmit}>
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
                            )}
                        </div>
                    </>
                ) : (
                    <div className={styles.userMenu} ref={userMenuRef}>
                        <button
                            type="button"
                            className={styles.userName}
                            aria-expanded={menuOpen}
                            aria-controls="user-dropdown"
                            onClick={() => setMenuOpen((v) => !v)}
                        >
                            {user.name || 'User'}
                        </button>
                        {menuOpen && (
                            <div id="user-dropdown" className={styles.dropdown}>
                                <a
                                    className={styles.dropdownItem}
                                    href="#/board"
                                    onClick={(e) => {
                                        e.preventDefault();
                                        setMenuOpen(false);
                                        handleGoToMyBoard();
                                    }}
                                >
                                    {navigatingMyBoard ? 'My Board…' : 'My Board'}
                                </a>
                                <a
                                    className={styles.dropdownItem}
                                    href="#/settings"
                                    onClick={() => setMenuOpen(false)}
                                >
                                    Settings
                                </a>
                                {user?.role === 'admin' && (
                                    <>
                                        <a className={styles.dropdownItem} href="#/admin/metrics">Admin Metrics</a>
                                        <a className={styles.dropdownItem} href="#/admin/users">User Manager</a>
                                    </>
                                )}
                                <button className={styles.dropdownItemButton} onClick={handleLogout}>Logout</button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </nav>
    );
};


export default Navbar;