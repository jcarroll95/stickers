import React, { useState, useEffect, useCallback } from 'react';
import styles from './UserManager.module.css';
import apiClient from '../../services/apiClient';

/**
 * UserManager Component
 * Provides a paginated, searchable interface for administrators to manage users.
 */
const UserManager = () => {
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(10);

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'user',
    password: ''
  });
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `/auth/users?page=${page}&limit=${limit}`;
      if (search) {
        // Simple search by name or email using query params
        url += `&search=${encodeURIComponent(search)}`;
      }
      
      const response = await apiClient.get(url);
      
      setUsers(response.data || []);
      setPagination(response.pagination || {});
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  }, [page, limit, search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setPage(1); // Reset to first page on search
  };

  const handleOpenModal = (user = null) => {
    if (user) {
      setCurrentUser(user);
      setFormData({
        name: user.name,
        email: user.email,
        role: user.role,
        password: '' // Don't pre-fill password for updates
      });
    } else {
      setCurrentUser(null);
      setFormData({
        name: '',
        email: '',
        role: 'user',
        password: ''
      });
    }
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setCurrentUser(null);
    setFormData({
      name: '',
      email: '',
      role: 'user',
      password: ''
    });
  };

  const handleFormChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setFormError(null);
    try {
      if (currentUser) {
        // Update user
        const updateData = { ...formData };
        if (!updateData.password) delete updateData.password; // Don't send empty password
        
        await apiClient.put(`/auth/users/${currentUser._id}`, updateData);
      } else {
        // Create user
        await apiClient.post('/auth/users', formData);
      }
      handleCloseModal();
      fetchUsers();
    } catch (err) {
      setFormError(err.response?.data?.error || err.message || 'Operation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    if (window.confirm('Are you sure you want to delete this user?')) {
      try {
        await apiClient.delete(`/auth/users/${userId}`);
        fetchUsers();
      } catch (err) {
        alert(err.response?.data?.error || err.message || 'Delete failed');
      }
    }
  };

  return (
    <div className={styles.container}>
      <header className={styles.header}>
        <h1>User Manager</h1>
        <button 
          className={`${styles.button} ${styles.createButton}`}
          onClick={() => handleOpenModal()}
        >
          Create New User
        </button>
      </header>

      <div className={styles.controls}>
        <input
          type="text"
          placeholder="Search by name or email..."
          className={styles.searchInput}
          value={search}
          onChange={handleSearchChange}
        />
      </div>

      {error && <div className={styles.error}>{error}</div>}

      {loading ? (
        <div>Loading users...</div>
      ) : (
        <>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Created At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user._id}>
                  <td>{user.name}</td>
                  <td>{user.email}</td>
                  <td>{user.role}</td>
                  <td>{user.isVerified ? 'Verified' : 'Pending'}</td>
                  <td>{new Date(user.createdAt).toLocaleDateString()}</td>
                  <td className={styles.actions}>
                    <button 
                      className={`${styles.button} ${styles.editButton}`}
                      onClick={() => handleOpenModal(user)}
                    >
                      Edit
                    </button>
                    <button 
                      className={`${styles.button} ${styles.deleteButton}`}
                      onClick={() => handleDeleteUser(user._id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className={styles.pagination}>
            <button
              className={styles.button}
              disabled={!pagination.prev}
              onClick={() => setPage(page - 1)}
            >
              Previous
            </button>
            <span>Page {page} of {pagination.totalPages || 1}</span>
            <button
              className={styles.button}
              disabled={!pagination.next}
              onClick={() => setPage(page + 1)}
            >
              Next
            </button>
          </div>
        </>
      )}

      {/* User Modal */}
      {isModalOpen && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <h2 className={styles.modalHeader}>
              {currentUser ? 'Edit User' : 'Create New User'}
            </h2>
            
            {formError && <div className={styles.error}>{formError}</div>}
            
            <form onSubmit={handleFormSubmit}>
              <div className={styles.formGroup}>
                <label htmlFor="name">Name</label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleFormChange}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="email">Email</label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleFormChange}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="role">Role</label>
                <select
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={handleFormChange}
                >
                  <option value="user">User</option>
                  <option value="vipuser">VIP User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label htmlFor="password">
                  Password {currentUser && '(leave blank to keep current)'}
                </label>
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleFormChange}
                  required={!currentUser}
                  minLength={6}
                />
              </div>
              
              <div className={styles.modalActions}>
                <button
                  type="button"
                  className={`${styles.button} ${styles.cancelButton}`}
                  onClick={handleCloseModal}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`${styles.button} ${styles.createButton}`}
                  disabled={submitting}
                >
                  {submitting ? 'Saving...' : currentUser ? 'Update User' : 'Create User'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManager;
