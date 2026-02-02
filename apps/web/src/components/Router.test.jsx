import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Router from './Router.jsx';
import useAuthStore from '../store/authStore.js';

// Mock child components
vi.mock('../StickerboardsDemo', () => ({ default: () => <div data-testid="boards-demo" /> }));
vi.mock('./board/BoardView', () => ({ default: () => <div data-testid="board-view" /> }));
vi.mock('./explore/Explore', () => ({ default: () => <div data-testid="explore" /> }));
vi.mock('./auth/RegisterVerify', () => ({ default: () => <div data-testid="register-verify" /> }));
vi.mock('./board/CreateStickerboard', () => ({ default: () => <div data-testid="create-board" /> }));
vi.mock('./user/UserSettings', () => ({ default: () => <div data-testid="user-settings" /> }));

vi.mock('../store/authStore', () => ({
  default: vi.fn(),
}));

describe('Router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.location.hash = '';
  });

  it('should render Home by default', async () => {
    useAuthStore.mockReturnValue({ isAuthenticated: false });
    render(<Router />);
    await waitFor(() => expect(screen.getByText(/Your GLP-1 Journey/i)).toBeInTheDocument());
  });

  it('should render RegisterVerify for #/register', async () => {
    useAuthStore.mockReturnValue({ isAuthenticated: false });
    window.location.hash = '#/register';
    render(<Router />);
    await waitFor(() => expect(screen.getByTestId('register-verify')).toBeInTheDocument());
  });

  it('should render Explore for #/explore', async () => {
    useAuthStore.mockReturnValue({ isAuthenticated: false });
    window.location.hash = '#/explore';
    render(<Router />);
    await waitFor(() => expect(screen.getByTestId('explore')).toBeInTheDocument());
  });

  it('should redirect to Home for #/board/create if unauthenticated', async () => {
    useAuthStore.mockReturnValue({ isAuthenticated: false });
    window.location.hash = '#/board/create';
    render(<Router />);
    await waitFor(() => expect(screen.getByText(/Your GLP-1 Journey/i)).toBeInTheDocument());
    expect(window.location.hash).toBe('#/');
  });

  it('should render CreateStickerboard for #/board/create if authenticated', async () => {
    useAuthStore.mockReturnValue({ isAuthenticated: true });
    window.location.hash = '#/board/create';
    render(<Router />);
    await waitFor(() => expect(screen.getByTestId('create-board')).toBeInTheDocument());
  });

  it('should render BoardView for #/board/:token if authenticated', async () => {
    useAuthStore.mockReturnValue({ isAuthenticated: true });
    window.location.hash = '#/board/some-token';
    render(<Router />);
    await waitFor(() => expect(screen.getByTestId('board-view')).toBeInTheDocument());
  });
  
  it('should render UserSettings for #/settings if authenticated', async () => {
    useAuthStore.mockReturnValue({ isAuthenticated: true });
    window.location.hash = '#/settings';
    render(<Router />);
    await waitFor(() => expect(screen.getByTestId('user-settings')).toBeInTheDocument());
  });

  it('should redirect to Home for #/settings if unauthenticated', async () => {
    useAuthStore.mockReturnValue({ isAuthenticated: false });
    window.location.hash = '#/settings';
    render(<Router />);
    await waitFor(() => expect(screen.getByText(/Your GLP-1 Journey/i)).toBeInTheDocument());
  });
});
