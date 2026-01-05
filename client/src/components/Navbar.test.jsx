import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Navbar from './Navbar';
import useAuthStore from '../store/authStore';
import { server } from '../test/setup';
import { http, HttpResponse } from 'msw';

// Mock auth store
vi.mock('../store/authStore', () => ({
  default: vi.fn(),
}));

describe('Navbar', () => {
  const mockLogin = vi.fn();
  const mockLogout = vi.fn();
  const mockInitialize = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.mockReturnValue({
      user: null,
      login: mockLogin,
      logout: mockLogout,
      initialize: mockInitialize,
    });
  });

  it('should render Login button when unauthenticated', () => {
    render(<Navbar />);
    expect(screen.getByRole('button', { name: /login/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('should render user name when authenticated', () => {
    useAuthStore.mockReturnValue({
      user: { name: 'Jane Doe' },
      login: mockLogin,
      logout: mockLogout,
      initialize: mockInitialize,
    });
    render(<Navbar />);
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
  });

  it('should show login dropdown when login button is clicked', () => {
    render(<Navbar />);
    const loginBtn = screen.getByRole('button', { name: /login/i });
    fireEvent.click(loginBtn);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('should handle login submission', async () => {
    // Setup MSW handlers
    server.use(
      http.post('*/auth/login', () => {
        return HttpResponse.json({ success: true, token: 'fake-token' });
      }),
      http.get('*/auth/me', () => {
        return HttpResponse.json({ success: true, data: { name: 'Jane Doe' } });
      })
    );

    render(<Navbar />);
    fireEvent.click(screen.getByRole('button', { name: /login/i }));
    
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'test@example.com' } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith({ name: 'Jane Doe' });
    });
  });

  it('should handle logout', async () => {
    useAuthStore.mockReturnValue({
      user: { name: 'Jane Doe' },
      login: mockLogin,
      logout: mockLogout,
      initialize: mockInitialize,
    });

    render(<Navbar />);
    
    // Open user menu
    fireEvent.click(screen.getByText('Jane Doe'));
    
    // Click logout
    const logoutBtn = screen.getByRole('button', { name: /logout/i });
    fireEvent.click(logoutBtn);

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled();
    });
  });

  it('should handle "My Board" click when authenticated', async () => {
    const mockUser = { id: 'owner-id', name: 'Jane' };
    useAuthStore.mockReturnValue({
      user: mockUser,
      login: mockLogin,
      logout: mockLogout,
      initialize: mockInitialize,
    });

    const mockBoards = [{ _id: 'b1', name: 'My Board', slug: 'my-board' }];

    server.use(
      http.get('*/auth/me', () => HttpResponse.json({ success: true, data: mockUser })),
      http.get('*/stickerboards', () => HttpResponse.json({ success: true, data: mockBoards }))
    );

    render(<Navbar />);
    
    // "My Board" link is usually rendered as a list item with role="button" or similar
    const myBoardLink = screen.getByText(/my board/i);
    fireEvent.click(myBoardLink);

    await waitFor(() => {
      expect(window.location.hash).toBe('#/board/b1');
    });
  });

  it('should handle "Cheer!" click when authenticated', async () => {
    const mockUser = { id: 'owner-id', name: 'Jane' };
    useAuthStore.mockReturnValue({
      user: mockUser,
      login: mockLogin,
      logout: mockLogout,
      initialize: mockInitialize,
    });

    const mockBoards = [
      { _id: 'b2', name: 'Other Board', slug: 'other-board', user: 'other-id' }
    ];

    server.use(
      http.get('*/stickerboards', ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('user[ne]') === 'owner-id') {
          return HttpResponse.json({ success: true, data: mockBoards });
        }
        return HttpResponse.json({ success: true, data: [] });
      })
    );

    render(<Navbar />);
    
    const cheerBtn = screen.getByRole('button', { name: /cheer!/i });
    fireEvent.click(cheerBtn);

    await waitFor(() => {
      expect(window.location.hash).toBe('#/board/b2');
    });
  });
});
