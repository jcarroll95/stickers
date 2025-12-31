import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { toast } from 'react-hot-toast';

vi.mock('react-hot-toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    loading: vi.fn(),
    dismiss: vi.fn(),
  },
}));

import RegisterVerify from './RegisterVerify';
import { server } from '../../test/setup';
import { http, HttpResponse } from 'msw';

describe('RegisterVerify', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render step 1 by default', () => {
    render(<RegisterVerify />);
    expect(screen.getByText(/create your account/i)).toBeInTheDocument();
  });

  it('should transition to step 2 after starting registration', async () => {
    server.use(
      http.post('*/auth/register-start', () => {
        return HttpResponse.json({ success: true });
      })
    );

    render(<RegisterVerify />);
    
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'John Doe' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'john@example.com' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password123' } });
    
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByText(/enter verification code/i)).toBeInTheDocument();
    });
  });

  it('should show error message if registration start fails', async () => {
    server.use(
      http.post('*/auth/register-start', () => {
        return HttpResponse.json({ success: false, error: 'Email already exists' }, { status: 400 });
      })
    );

    render(<RegisterVerify />);
    
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'John Doe' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'john@example.com' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password123' } });
    
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    await waitFor(() => {
      expect(screen.getByText(/email already exists/i)).toBeInTheDocument();
    });
  });

  it('should handle code verification and routing', async () => {
    server.use(
      http.post('*/auth/register-start', () => HttpResponse.json({ success: true })),
      http.post('*/auth/register-verify', () => HttpResponse.json({ success: true, token: 'verified-token' })),
      http.get('*/auth/me', () => HttpResponse.json({ success: true, data: { _id: 'u1' } })),
      http.get('*/stickerboards', () => HttpResponse.json({ success: true, data: [] }))
    );

    render(<RegisterVerify />);
    
    // Step 1
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'John' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'john@example.com' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    // Step 2
    await waitFor(() => expect(screen.getByText(/enter verification code/i)).toBeInTheDocument());
    
    const inputs = screen.getAllByRole('textbox');
    // Code is 123456
    inputs.forEach((input, i) => {
      fireEvent.change(input, { target: { value: String(i + 1) } });
    });

    fireEvent.click(screen.getByRole('button', { name: /verify/i }));

    await waitFor(() => {
      expect(window.location.hash).toBe('#/board/create');
    });
  });

  it('should handle resend code', async () => {
    server.use(
      http.post('*/auth/register-start', () => HttpResponse.json({ success: true })),
      http.post('*/auth/register-resend', () => {
        console.log('MSW: Handling register-resend');
        return HttpResponse.json({ success: true });
      })
    );

    render(<RegisterVerify />);
    
    // Trigger Step 2
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'John' } });
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'john@example.com' } });
    fireEvent.change(screen.getByLabelText(/^password$/i), { target: { value: 'password123' } });
    fireEvent.change(screen.getByLabelText(/confirm password/i), { target: { value: 'password123' } });
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    // Wait for the resend button to be available
    const resendBtn = await screen.findByRole('button', { name: /resend code/i });
    expect(resendBtn).not.toBeDisabled();
    fireEvent.click(resendBtn);

    await waitFor(() => {
      expect(screen.getByText(/a new code has been sent/i)).toBeInTheDocument();
    });
  });
});
