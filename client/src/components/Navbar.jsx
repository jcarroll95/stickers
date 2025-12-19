import React from 'react';
import styles from './Navbar.module.css';

// functional component definition describes a js func that returns JSX, this is how compnents are written
const Navbar = () => {
    return (
        <nav className={styles.nav}>
            <div className={styles.logo}>Stickerboards</div>
            <ul className={styles.navLinks}>
                <li className={styles.link}>My Board</li>
                <li className={styles.link}>Explore</li>
                <li className={styles.link}>Cheer!</li>
                <li className={styles.link}>Developer Docs</li>
            </ul>
            <div className={styles.auth}>
                <button className={styles.button}>Login</button>
            </div>
        </nav>
    );
};


export default Navbar;