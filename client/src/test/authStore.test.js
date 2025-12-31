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
      isAuthenticated: false,
      isLoading: false,
      error: null,
    });
    vi.clearAllMocks();
    localStorage.clear();
  });

  it('should initialize with no user if /auth/me fails', async () => {
    apiClient.get.mockRejectedValueOnce(new Error('Unauthorized'));
    await useAuthStore.getState().initialize();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBe(null);
  });

  it('should initialize with user if /auth/me succeeds', async () => {
    const mockUser = { id: '1', name: 'Test User' };
    apiClient.get.mockResolvedValueOnce({ success: true, data: mockUser });

    await useAuthStore.getState().initialize();

    expect(apiClient.get).toHaveBeenCalledWith('/auth/me');
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().user).toEqual(mockUser);
  });

  it('should clear session if initialize fails', async () => {
    apiClient.get.mockRejectedValueOnce(new Error('Unauthorized'));

    await useAuthStore.getState().initialize();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  it('should update state on login', () => {
    const mockUser = { id: '1', name: 'Test User' };

    useAuthStore.getState().login(mockUser);

    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().user).toEqual(mockUser);
  });

  it('should handle auth:unauthorized event', async () => {
    useAuthStore.setState({ isAuthenticated: true });
    
    // Manual trigger of initialize to ensure event listener is registered
    const store = useAuthStore.getState();
    
    apiClient.get.mockResolvedValueOnce({ success: true, data: { name: 'User' } });
    await store.initialize();
    
    // Now trigger the event
    await act(async () => {
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    });
    
    // Verify logout logic was triggered
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
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
    useAuthStore.setState({ isAuthenticated: true, user: { name: 'User' } });

    apiClient.get.mockResolvedValueOnce({ success: true });

    await useAuthStore.getState().logout();

    expect(apiClient.get).toHaveBeenCalledWith('/auth/logout');
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().user).toBe(null);
    expect(window.location.hash).toBe('#/');
  });
});
