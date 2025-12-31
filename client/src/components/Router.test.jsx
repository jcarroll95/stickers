import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Router from './Router';
import useAuthStore from '../store/authStore';

// Mock child components
vi.mock('../StickerboardsDemo', () => ({ default: () => <div data-testid="boards-demo" /> }));
vi.mock('./board/BoardView', () => ({ default: () => <div data-testid="board-view" /> }));
vi.mock('./explore/Explore', () => ({ default: () => <div data-testid="explore" /> }));
vi.mock('./auth/RegisterVerify', () => ({ default: () => <div data-testid="register-verify" /> }));
vi.mock('./board/CreateStickerboard', () => ({ default: () => <div data-testid="create-board" /> }));

vi.mock('../store/authStore', () => ({
  default: vi.fn(),
}));

describe('Router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.location.hash = '';
  });

  it('should render Home by default', () => {
    useAuthStore.mockReturnValue({ isAuthenticated: false });
    render(<Router />);
    expect(screen.getByText(/welcome/i)).toBeInTheDocument();
  });

  it('should render RegisterVerify for #/register', () => {
    useAuthStore.mockReturnValue({ isAuthenticated: false });
    window.location.hash = '#/register';
    render(<Router />);
    expect(screen.getByTestId('register-verify')).toBeInTheDocument();
  });

  it('should render Explore for #/explore', () => {
    useAuthStore.mockReturnValue({ isAuthenticated: false });
    window.location.hash = '#/explore';
    render(<Router />);
    expect(screen.getByTestId('explore')).toBeInTheDocument();
  });

  it('should redirect to Home for #/board/create if unauthenticated', () => {
    useAuthStore.mockReturnValue({ isAuthenticated: false });
    window.location.hash = '#/board/create';
    render(<Router />);
    expect(screen.getByText(/welcome/i)).toBeInTheDocument();
    expect(window.location.hash).toBe('#/');
  });

  it('should render CreateStickerboard for #/board/create if authenticated', () => {
    useAuthStore.mockReturnValue({ isAuthenticated: true });
    window.location.hash = '#/board/create';
    render(<Router />);
    expect(screen.getByTestId('create-board')).toBeInTheDocument();
  });

  it('should render BoardView for #/board/:token if authenticated', () => {
    useAuthStore.mockReturnValue({ isAuthenticated: true });
    window.location.hash = '#/board/some-token';
    render(<Router />);
    expect(screen.getByTestId('board-view')).toBeInTheDocument();
  });
});
