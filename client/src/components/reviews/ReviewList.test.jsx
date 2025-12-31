import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import ReviewList from './ReviewList';
import { server } from '../../test/setup';
import { http, HttpResponse } from 'msw';

describe('ReviewList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading state initially', () => {
    render(<ReviewList boardId="123" />);
    expect(screen.getByText(/loading reviews…/i)).toBeInTheDocument();
  });

  it('should render list of reviews on success', async () => {
    const mockReviews = [
      { _id: 'r1', comment: 'Great board!', reviewRating: 5, createdAt: new Date().toISOString(), belongsToUser: { name: 'User 1' } },
      { _id: 'r2', comment: 'Nice colors', reviewRating: 4, createdAt: new Date().toISOString(), belongsToUser: { name: 'User 2' } },
    ];

    server.use(
      http.get('*/stickerboards/123/reviews', () => {
        return HttpResponse.json({ success: true, data: mockReviews });
      })
    );

    render(<ReviewList boardId="123" />);

    await waitFor(() => {
      expect(screen.getByText('Great board!')).toBeInTheDocument();
      expect(screen.getByText('Nice colors')).toBeInTheDocument();
      expect(screen.getByText(/by User 1/i)).toBeInTheDocument();
      expect(screen.getByText(/Rating: 5 \/ 5/i)).toBeInTheDocument();
    });
  });

  it('should show message if no reviews exist', async () => {
    server.use(
      http.get('*/stickerboards/123/reviews', () => {
        return HttpResponse.json({ success: true, data: [] });
      })
    );

    render(<ReviewList boardId="123" />);

    await waitFor(() => {
      expect(screen.getByText(/no reviews yet/i)).toBeInTheDocument();
    });
  });

  it('should show error message if fetch fails', async () => {
    server.use(
      http.get('*/stickerboards/123/reviews', () => {
        return HttpResponse.json({ success: false, error: 'Fetch failed' }, { status: 500 });
      })
    );

    render(<ReviewList boardId="123" />);

    await waitFor(() => {
      expect(screen.getByText(/error: fetch failed/i)).toBeInTheDocument();
    });
  });
});
