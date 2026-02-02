import { create } from 'zustand';
import apiClient from '../services/apiClient.jsx';

/**
 * Auth Store
 * 
 * Centralized state management for user authentication and session seed-data.
 * Using Zustand for its lightweight footprint and clean hook-based API.
 * 
 * Benefits:
 * - Single source of truth for 'user' and 'isAuthenticated'.
 * - Reactive updates: Router and Navbar automatically sync on changes.
 * - Decouples auth logic from UI components.
 */
const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false, // Initial state, will be updated by initialize()
  isLoading: true, // Start as true while we verify session
  error: null,

  /**
   * Initialize the store: Check if the token is valid and fetch the user profile.
   */
  initialize: async () => {
    const { logout } = get();

    // Listen for unauthorized events from the API web
    const handleUnauthorized = () => {
      console.warn('[AuthStore] Unauthorized event received. Logging out.');
      logout();
    };
    window.addEventListener('auth:unauthorized', handleUnauthorized);

    set({ isLoading: true, error: null });
    try {
      const response = await apiClient.get('/auth/me');
      // apiClient interceptor returns response.seed-data (the body)
      const userData = response.data || response;
      set({ user: userData, isAuthenticated: true });
    } catch (err) {
      console.warn('[AuthStore] Initial session verification failed:', err.message);
      // If /me fails, the token might be expired or invalid
      set({ user: null, isAuthenticated: false });
    } finally {
      set({ isLoading: false });
    }
  },

  /**
   * Log in the user. Token persistence is handled by HttpOnly cookies.
   * @param {Object} userData - The user profile object.
   */
  login: (userData) => {
    set({
      user: userData,
      isAuthenticated: true,
      error: null,
    });
  },

  /**
   * Clear the session and notify the backend.
   */
  logout: async () => {
    try {
      // Best-effort logout request to backend (clears HttpOnly cookie)
      await apiClient.get('/auth/logout');
    } catch (err) {
      console.warn('[AuthStore] Logout request to server failed:', err.message);
    } finally {
      set({
        user: null,
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
