import React from 'react';
import styles from '../Navbar.module.css';

const UserMenuDropdown = ({ 
    user, 
    navigatingMyBoard, 
    onGoToMyBoard, 
    onLogout, 
    onClose 
}) => (
    <div id="user-dropdown" className={styles.dropdown}>
        <a
            className={styles.dropdownItem}
            href="#/board"
            onClick={(e) => {
                e.preventDefault();
                onClose();
                onGoToMyBoard();
            }}
        >
            {navigatingMyBoard ? 'My Board…' : 'My Board'}
        </a>
        <a
            className={styles.dropdownItem}
            href="#/settings"
            onClick={() => onClose()}
        >
            Settings
        </a>
        {user?.role === 'admin' && (
            <>
                <a className={styles.dropdownItem} href="#/admin/metrics">Admin Metrics</a>
                <a className={styles.dropdownItem} href="#/admin/users">User Manager</a>
                <a className={styles.dropdownItem} href="#/admin/stickers">Sticker Picker</a>
            </>
        )}
        <button className={styles.dropdownItemButton} onClick={onLogout}>Logout</button>
    </div>
);

export default UserMenuDropdown;
