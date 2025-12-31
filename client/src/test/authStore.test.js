import { describe, it, expect, beforeEach, vi } from 'vitest';
import { act } from '@testing-library/react';
import useAuthStore from '../store/authStore';
import apiClient from '../services/apiClient';

vi.mock('../services/apiClient', () => ({
  default: {
    get: vi.fn(),
  },
}));

describe('authStore', () => {
  beforeEach(() => {
    // Reset Zustand store state before each test
    useAuthStore.setState({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should initialize with no user if no token exists', async () => {
    await useAuthStore.getState().initialize();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBe(null);
  });

  it('should initialize with user if valid token exists', async () => {
    localStorage.setItem('token', 'valid-token');
    // Ensure the store knows about the token before initialize
    useAuthStore.setState({ token: 'valid-token' });
    
    const mockUser = { id: '1', name: 'Test User' };
    apiClient.get.mockResolvedValueOnce({ success: true, data: mockUser });

    await useAuthStore.getState().initialize();

    expect(apiClient.get).toHaveBeenCalledWith('/auth/me');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().user).toEqual(mockUser);
  });

  it('should clear session if initialize fails', async () => {
    localStorage.setItem('token', 'invalid-token');
    useAuthStore.setState({ token: 'invalid-token' });
    
    apiClient.get.mockRejectedValueOnce(new Error('Unauthorized'));

    await useAuthStore.getState().initialize();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().token).toBe(null);
    expect(localStorage.getItem('token')).toBe(null);
  });

  it('should update state on login', () => {
    const mockUser = { id: '1', name: 'Test User' };
    const token = 'new-token';

    useAuthStore.getState().login(mockUser, token);

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().user).toEqual(mockUser);
    expect(useAuthStore.getState().token).toBe(token);
    expect(localStorage.getItem('token')).toBe(token);
  });

  it('should handle auth:unauthorized event', async () => {
    localStorage.setItem('token', 'token');
    useAuthStore.setState({ isAuthenticated: true, token: 'token' });
    
    // Manual trigger of initialize to ensure event listener is registered
    const store = useAuthStore.getState();
    
    // We need to wait for the next tick to ensure the listener is registered
    // Or we can just call initialize and let it finish
    apiClient.get.mockResolvedValueOnce({ success: true, data: { name: 'User' } });
    await store.initialize();
    
    // Now trigger the event
    await act(async () => {
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    });
    
    // Verify logout logic was triggered
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(localStorage.getItem('token')).toBe(null);
  });

  it('should update user via setUser', () => {
    const mockUser = { name: 'Manually Set' };
    useAuthStore.getState().setUser(mockUser);
    expect(useAuthStore.getState().user).toEqual(mockUser);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('should set error via setError', () => {
    const error = 'Something went wrong';
    useAuthStore.getState().setError(error);
    expect(useAuthStore.getState().error).toBe(error);
  });

  it('should clear state on logout', async () => {
    localStorage.setItem('token', 'token');
    useAuthStore.setState({ isAuthenticated: true, user: { name: 'User' }, token: 'token' });

    apiClient.get.mockResolvedValueOnce({ success: true });

    await useAuthStore.getState().logout();

    expect(apiClient.get).toHaveBeenCalledWith('/auth/logout');
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBe(null);
    expect(localStorage.getItem('token')).toBe(null);
    expect(window.location.hash).toBe('#/');
  });
});
