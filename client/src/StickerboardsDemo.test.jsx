import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import StickerboardsDemo from './StickerboardsDemo';
import { server } from './test/setup';
import { http, HttpResponse } from 'msw';

describe('StickerboardsDemo', () => {
  it('should render loading state initially', () => {
    server.use(
      http.get('*/stickerboards', () => {
        return new Promise(() => {}); // stay in loading state
      })
    );
    render(<StickerboardsDemo />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('should render data on success', async () => {
    const mockData = { success: true, data: [{ name: 'Demo Board' }] };
    server.use(
      http.get('*/stickerboards', () => HttpResponse.json(mockData))
    );

    render(<StickerboardsDemo />);

    await waitFor(() => {
      expect(screen.getByText(/Demo Board/i)).toBeInTheDocument();
    });
  });

  it('should render error message on failure', async () => {
    server.use(
      http.get('*/stickerboards', () => HttpResponse.json({ success: false, error: 'Demo error' }, { status: 500 }))
    );

    render(<StickerboardsDemo />);

    await waitFor(() => {
      expect(screen.getByText(/error: demo error/i)).toBeInTheDocument();
    });
  });
});
