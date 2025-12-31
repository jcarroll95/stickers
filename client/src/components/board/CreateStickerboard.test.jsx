import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import CreateStickerboard from './CreateStickerboard';
import { server } from '../../test/setup';
import { http, HttpResponse } from 'msw';

describe('CreateStickerboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.location.hash = '';
  });

  it('should render form elements', () => {
    render(<CreateStickerboard />);
    expect(screen.getByLabelText(/board name/i)).toBeInTheDocument();
    expect(screen.getByText(/choose a background/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create stickerboard/i })).toBeInTheDocument();
  });

  it('should have submit button disabled by default', () => {
    render(<CreateStickerboard />);
    expect(screen.getByRole('button', { name: /create stickerboard/i })).toBeDisabled();
  });

  it('should enable submit button after entering name and selecting background', () => {
    render(<CreateStickerboard />);
    
    fireEvent.change(screen.getByLabelText(/board name/i), { target: { value: 'My New Board' } });
    // Select the first background tile
    const bgTiles = screen.getAllByRole('button', { name: /^background sb/i });
    fireEvent.click(bgTiles[0]);

    expect(screen.getByRole('button', { name: /create stickerboard/i })).not.toBeDisabled();
  });

  it('should handle successful board creation', async () => {
    const mockCreatedBoard = { _id: 'new-id', name: 'My New Board', slug: 'my-new-board' };
    
    server.use(
      http.post('*/stickerboards', () => {
        return HttpResponse.json({ success: true, data: mockCreatedBoard });
      })
    );

    render(<CreateStickerboard />);
    
    fireEvent.change(screen.getByLabelText(/board name/i), { target: { value: 'My New Board' } });
    fireEvent.click(screen.getAllByRole('button', { name: /^background sb/i })[0]);
    
    fireEvent.click(screen.getByRole('button', { name: /create stickerboard/i }));

    await waitFor(() => {
      expect(window.location.hash).toBe('#/board/my-new-board');
    });
  });

  it('should show error message if creation fails', async () => {
    server.use(
      http.post('*/stickerboards', () => {
        return HttpResponse.json({ success: false, error: 'Name must be unique' }, { status: 400 });
      })
    );

    render(<CreateStickerboard />);
    
    fireEvent.change(screen.getByLabelText(/board name/i), { target: { value: 'Existing Board' } });
    fireEvent.click(screen.getAllByRole('button', { name: /^background sb/i })[0]);
    
    fireEvent.click(screen.getByRole('button', { name: /create stickerboard/i }));

    await waitFor(() => {
      expect(screen.getByText(/name must be unique/i)).toBeInTheDocument();
    });
  });
});
