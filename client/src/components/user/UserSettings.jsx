import React, { useState, useEffect } from 'react';
import useAuthStore from '../../store/authStore';
import apiClient from '../../services/apiClient';
import LoadingSpinner from '../common/LoadingSpinner.jsx';
import styles from './UserSettings.module.css';

/**
 * UserSettings Component
 * Allows logged-in users to update their profile, password, and primary board name.
 */
const UserSettings = () => {
    const { user, setUser } = useAuthStore();
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });
    
    // Form states
    const [profileData, setProfileData] = useState({ name: '', email: '' });
    const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '' });
    const [boardData, setBoardData] = useState({ name: '', id: '' });

    useEffect(() => {
        const fetchData = async () => {
            if (!user) return;
            
            try {
                setLoading(true);
                // Refresh user data
                const userRes = await apiClient.get('/auth/me');
                const userData = userRes.data || userRes;
                setProfileData({ name: userData.name || '', email: userData.email || '' });
                
                // Fetch user's board
                const uid = userData._id || userData.id;
                const boardRes = await apiClient.get(`/stickerboards?user=${uid}&limit=1`);
                const boards = boardRes.data || (Array.isArray(boardRes) ? boardRes : []);
                if (boards.length > 0) {
                    setBoardData({ name: boards[0].name, id: boards[0]._id || boards[0].id });
                }
            } catch (err) {
                console.error('Failed to load settings data:', err);
                setMessage({ text: 'Failed to load some settings.', type: 'error' });
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [user]);

    const handleProfileUpdate = async (e) => {
        e.preventDefault();
        setUpdating(true);
        setMessage({ text: '', type: '' });
        try {
            const res = await apiClient.put('/auth/updatedetails', profileData);
            const updatedUser = res.data || res;
            setUser(updatedUser);
            setMessage({ text: 'Profile updated successfully!', type: 'success' });
        } catch (err) {
            setMessage({ text: err.response?.data?.error || 'Failed to update profile.', type: 'error' });
        } finally {
            setUpdating(false);
        }
    };

    const handlePasswordUpdate = async (e) => {
        e.preventDefault();
        setUpdating(true);
        setMessage({ text: '', type: '' });
        try {
            await apiClient.put('/auth/updatepassword', passwordData);
            setPasswordData({ currentPassword: '', newPassword: '' });
            setMessage({ text: 'Password updated successfully!', type: 'success' });
        } catch (err) {
            setMessage({ text: err.response?.data?.error || 'Failed to update password.', type: 'error' });
        } finally {
            setUpdating(false);
        }
    };

    const handleBoardUpdate = async (e) => {
        e.preventDefault();
        if (!boardData.id) return;
        setUpdating(true);
        setMessage({ text: '', type: '' });
        try {
            await apiClient.put(`/stickerboards/${boardData.id}`, { name: boardData.name });
            setMessage({ text: 'Board name updated successfully!', type: 'success' });
        } catch (err) {
            setMessage({ text: err.response?.data?.error || 'Failed to update board name.', type: 'error' });
        } finally {
            setUpdating(false);
        }
    };

    if (loading) return <LoadingSpinner message="Loading settings..." />;

    return (
        <div className={styles.container}>
            <h1>User Settings</h1>
            
            {message.text && (
                <div className={`${styles.alert} ${styles[message.type]}`}>
                    {message.text}
                </div>
            )}

            <div className={styles.section}>
                <h2>Profile Information</h2>
                <form onSubmit={handleProfileUpdate} className={styles.form}>
                    <div className={styles.formGroup}>
                        <label htmlFor="name">Name</label>
                        <input
                            type="text"
                            id="name"
                            value={profileData.name}
                            onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                            required
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label htmlFor="email">Email Address</label>
                        <input
                            type="email"
                            id="email"
                            value={profileData.email}
                            onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                            required
                        />
                    </div>
                    <button type="submit" className={styles.button} disabled={updating}>
                        {updating ? 'Updating...' : 'Save Profile'}
                    </button>
                </form>
            </div>

            {boardData.id && (
                <div className={styles.section}>
                    <h2>Board Settings</h2>
                    <form onSubmit={handleBoardUpdate} className={styles.form}>
                        <div className={styles.formGroup}>
                            <label htmlFor="boardName">Stickerboard Name</label>
                            <input
                                type="text"
                                id="boardName"
                                value={boardData.name}
                                onChange={(e) => setBoardData({ ...boardData, name: e.target.value })}
                                required
                            />
                        </div>
                        <button type="submit" className={styles.button} disabled={updating}>
                            {updating ? 'Updating...' : 'Update Board Name'}
                        </button>
                    </form>
                </div>
            )}

            <div className={styles.section}>
                <h2>Change Password</h2>
                <form onSubmit={handlePasswordUpdate} className={styles.form}>
                    <div className={styles.formGroup}>
                        <label htmlFor="currentPassword">Current Password</label>
                        <input
                            type="password"
                            id="currentPassword"
                            value={passwordData.currentPassword}
                            onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                            required
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label htmlFor="newPassword">New Password</label>
                        <input
                            type="password"
                            id="newPassword"
                            value={passwordData.newPassword}
                            onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                            required
                            minLength="6"
                        />
                    </div>
                    <button type="submit" className={styles.button} disabled={updating}>
                        {updating ? 'Updating...' : 'Update Password'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default UserSettings;
