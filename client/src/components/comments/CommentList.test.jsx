import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import CommentList from './CommentList';
import { server } from '../../test/setup';
import { http, HttpResponse } from 'msw';

describe('CommentList', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render loading state initially', () => {
    server.use(
      http.get('*/stickerboards/123/comments', () => {
        return new Promise(() => {}); // never resolves to stay in loading state
      })
    );
    render(<CommentList boardId="123" />);
    expect(screen.getByText(/loading comments…/i)).toBeInTheDocument();
  });

  it('should render list of comments on success', async () => {
    const mockComments = [
      { _id: 'r1', comment: 'Great board!', commentRating: 5, createdAt: new Date().toISOString(), belongsToUser: { name: 'User 1' } },
      { _id: 'r2', comment: 'Nice colors', commentRating: 4, createdAt: new Date().toISOString(), belongsToUser: { name: 'User 2' } },
    ];

    server.use(
      http.get('*/stickerboards/123/comments', () => {
        return HttpResponse.json({ success: true, data: mockComments });
      })
    );

    render(<CommentList boardId="123" />);

    await waitFor(() => {
      expect(screen.getByText('Great board!')).toBeInTheDocument();
      expect(screen.getByText('Nice colors')).toBeInTheDocument();
      expect(screen.getByText(/by User 1/i)).toBeInTheDocument();
      expect(screen.getByText(/Rating: 5 \/ 5/i)).toBeInTheDocument();
    });
  });

  it('should show message if no comments exist', async () => {
    server.use(
      http.get('*/stickerboards/123/comments', () => {
        return HttpResponse.json({ success: true, data: [] });
      })
    );

    render(<CommentList boardId="123" />);

    await waitFor(() => {
      expect(screen.getByText(/no comments yet/i)).toBeInTheDocument();
    });
  });

  it('should show error message if fetch fails', async () => {
    server.use(
      http.get('*/stickerboards/123/comments', () => {
        return HttpResponse.json({ success: false, error: 'Fetch failed' }, { status: 500 });
      })
    );

    render(<CommentList boardId="123" />);

    await waitFor(() => {
      expect(screen.getByText(/error: fetch failed/i)).toBeInTheDocument();
    });
  });
});
