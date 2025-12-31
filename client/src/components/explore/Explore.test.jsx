import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import Explore from './Explore';
import { server } from '../../test/setup';
import { http, HttpResponse } from 'msw';

describe('Explore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render and load boards', async () => {
    const mockBoards = [
      { _id: '1', name: 'Board 1', photo: 'sb0.png', stickers: [] },
      { _id: '2', name: 'Board 2', photo: 'sb1.png', stickers: [] },
    ];

    server.use(
      http.get('*/stickerboards', () => {
        return HttpResponse.json({ success: true, data: mockBoards, pagination: {} });
      })
    );

    render(<Explore />);
    
    expect(screen.getByRole('status')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Board 1')).toBeInTheDocument();
      expect(screen.getByText('Board 2')).toBeInTheDocument();
    });
  });

  it('should show error message if loading fails', async () => {
    server.use(
      http.get('*/stickerboards', () => {
        return HttpResponse.json({ success: false, error: 'Server error' }, { status: 500 });
      })
    );

    render(<Explore />);

    await waitFor(() => {
      expect(screen.getByText(/error: server error/i)).toBeInTheDocument();
    });
  });
});
