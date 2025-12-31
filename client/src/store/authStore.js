import { create } from 'zustand';
import apiClient from '../services/apiClient';

/**
 * Auth Store
 * 
 * Centralized state management for user authentication and session data.
 * Using Zustand for its lightweight footprint and clean hook-based API.
 * 
 * Benefits:
 * - Single source of truth for 'user' and 'isAuthenticated'.
 * - Reactive updates: Router and Navbar automatically sync on changes.
 * - Decouples auth logic from UI components.
 */
const useAuthStore = create((set, get) => ({
  user: null,
  token: localStorage.getItem('token') || null,
  isAuthenticated: !!localStorage.getItem('token'),
  isLoading: false,
  error: null,

  /**
   * Initialize the store: Check if the token is valid and fetch the user profile.
   */
  initialize: async () => {
    const { token, logout } = get();
    if (!token) {
      set({ isAuthenticated: false, user: null });
      return;
    }

    // Listen for unauthorized events from the API client
    const handleUnauthorized = () => {
      console.warn('[AuthStore] Unauthorized event received. Logging out.');
      logout();
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);

    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.get('/auth/me');
      // apiClient interceptor returns response.data (the body)
      const userData = response.data || response;
      set({ user: userData, isAuthenticated: true });
    } catch (err) {
      console.warn('[AuthStore] Initial session verification failed:', err.message);
      // If /me fails, the token might be expired or invalid
      set({ user: null, isAuthenticated: false, token: null });
      localStorage.removeItem('token');
    } finally {
      set({ isLoading: false });
    }
  },

  /**
   * Log in the user and persist the token.
   * @param {Object} userData - The user profile object.
   * @param {string} token - The JWT token.
   */
  login: (userData, token) => {
    localStorage.setItem('token', token);
    set({
      user: userData,
      token,
      isAuthenticated: true,
      error: null,
    });
  },

  /**
   * Clear the session and notify the backend.
   */
  logout: async () => {
    try {
      // Best-effort logout request to backend
      await apiClient.get('/auth/logout');
    } catch (err) {
      console.warn('[AuthStore] Logout request to server failed:', err.message);
    } finally {
      localStorage.removeItem('token');
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        error: null,
      });
      // Navigate to home if needed (can also be handled by reactive components)
      window.location.hash = '#/';
    }
  },

  /**
   * Set the current user profile manually.
   */
  setUser: (user) => set({ user, isAuthenticated: !!user }),

  /**
   * Set error state for auth-related operations.
   */
  setError: (error) => set({ error }),
}));

export default useAuthStore;
