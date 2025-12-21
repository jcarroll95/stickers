import React, { useEffect, useRef, useState } from 'react';
import styles from './Navbar.module.css';

// functional component definition describes a js func that returns JSX, this is how compnents are written
const Navbar = () => {
    const [user, setUser] = useState(null);
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

    // Attempt to fetch the current user using the backend's protect middleware
    useEffect(() => {
        let cancelled = false;

        const fetchMe = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await fetch('/api/v1/auth/me', {
                    method: 'GET',
                    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
                    // Send cookies if present (server must allow credentials via CORS when using different origins)
                    credentials: 'include'
                });

                if (!res.ok) {
                    // not logged in or token invalid
                    if (!cancelled) setUser(null);
                    return;
                }
                const data = await res.json();
                if (!cancelled) setUser(data?.data || null);
            } catch (e) {
                if (!cancelled) setUser(null);
            }
        };

        fetchMe();
        return () => {
            cancelled = true;
        };
    }, []);

    // Helper to safely extract a user id from various shapes
    const getUserId = (u) => u?.__id || u?._id || u?.id || u?.data?.__id || u?.data?._id || u?.data?.id || null;

    // Navigate to the currently logged-in user's stickerboard
    const handleGoToMyBoard = async () => {
        if (navigatingMyBoard) return;
        setNavigatingMyBoard(true);
        try {
            // Ensure we have the current user (and a token/cookie)
            let currentUser = user;
            const token = localStorage.getItem('token');
            if (!currentUser) {
                const meRes = await fetch('/api/v1/auth/me', {
                    method: 'GET',
                    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
                    credentials: 'include'
                });
                if (!meRes.ok) {
                    // Not authenticated – open login dropdown
                    setLoginOpen(true);
                    return;
                }
                const meData = await meRes.json();
                currentUser = meData?.data || null;
                setUser(currentUser);
            }

            const uid = getUserId(currentUser);
            if (!uid) {
                // Couldn't determine user id, prompt login as fallback
                setLoginOpen(true);
                return;
            }

            // Fetch this user's stickerboard(s). Limit to first.
            const sbRes = await fetch(`/api/v1/stickerboards?user=${encodeURIComponent(uid)}&limit=1`, {
                method: 'GET',
                credentials: 'include',
                headers: token ? { 'Authorization': `Bearer ${token}` } : {}
            });
            if (!sbRes.ok) {
                // If unauthorized, show login; otherwise, just no-op
                if (sbRes.status === 401) setLoginOpen(true);
                return;
            }
            const sbData = await sbRes.json();
            const board = sbData?.data?.[0] || null;
            if (!board) {
                // No board exists yet for user. Route to a generic board page or creation page if exists.
                // For now, send to the generic board route the app already links to.
                window.location.hash = '#/board';
                return;
            }

            // Prefer slug route if available, else id. Keep hash-based routing consistent with app.
            const boardToken = board.slug || board._id || board.id;
            if (boardToken) {
                window.location.hash = `#/board/${boardToken}`;
            } else {
                window.location.hash = '#/board';
            }
        } catch (_) {
            // Swallow errors to avoid breaking nav; optionally open login
        } finally {
            setNavigatingMyBoard(false);
        }
    };

    const handleLogout = async () => {
        try {
            // Clear any locally stored bearer token
            localStorage.removeItem('token');
            // Best-effort request to backend to clear cookie (if used)
            await fetch('/api/v1/auth/logout', { credentials: 'include' });
        } catch (_) {
            // ignore
        } finally {
            setUser(null);
            setMenuOpen(false);
            // Navigate to a neutral public route so private data is not shown
            window.location.hash = '#/';
            // Broadcast a logout event so any views can react immediately
            try { window.dispatchEvent(new CustomEvent('auth:logout')); } catch (_) {}
        }
    };

    const handleLoginSubmit = async (e) => {
        e.preventDefault();
        if (loggingIn) return;
        setLoginError('');
        setLoggingIn(true);
        try {
            const res = await fetch('/api/v1/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                credentials: 'include',
                body: JSON.stringify({ email, password })
            });

            const data = await res.json().catch(() => ({}));

            if (!res.ok || !data?.success) {
                throw new Error(data?.error || data?.message || 'Login failed');
            }

            // Save token locally for Bearer-based auth flows
            if (data.token) {
                localStorage.setItem('token', data.token);
            }

            // Fetch current user to populate menu
            const token = data.token || localStorage.getItem('token');
            const meRes = await fetch('/api/v1/auth/me', {
                method: 'GET',
                headers: token ? { 'Authorization': `Bearer ${token}` } : {},
                credentials: 'include'
            });
            if (meRes.ok) {
                const meData = await meRes.json();
                setUser(meData?.data || null);
                // reset form and close dropdown
                setEmail('');
                setPassword('');
                setLoginOpen(false);
            } else {
                // Even if login returned success, if /me fails, treat as error
                throw new Error('Unable to fetch user profile after login');
            }
        } catch (err) {
            setLoginError(err.message || 'Login failed');
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

            <ul className={styles.navLinks}>
                <li
                    className={styles.link}
                    role="button"
                    tabIndex={0}
                    aria-disabled={navigatingMyBoard}
                    onClick={handleGoToMyBoard}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleGoToMyBoard();
                        }
                    }}
                >
                    {navigatingMyBoard ? 'My Board…' : 'My Board'}
                </li>
                <li className={styles.link}>Explore</li>
                <li className={styles.link}>Cheer!</li>
                <li className={styles.link}>Developer Docs</li>
            </ul>


            <div className={styles.auth}>
                {!user ? (
                    <div className={styles.userMenu} ref={loginMenuRef}>
                        <button
                            className={styles.button}
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
                ) : (
                    <div className={styles.userMenu} ref={userMenuRef}>
                        <div
                            className={styles.userName}
                            role="button"
                            tabIndex={0}
                            aria-expanded={menuOpen}
                            aria-controls="user-dropdown"
                            onClick={() => setMenuOpen((v) => !v)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    setMenuOpen((v) => !v);
                                }
                            }}
                        >
                            {user.name || 'User'}
                        </div>
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
                                <a className={styles.dropdownItem} href="#/settings">Settings</a>
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