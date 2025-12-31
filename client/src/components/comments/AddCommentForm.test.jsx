import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import AddCommentForm from './AddCommentForm';
import { server } from '../../test/setup';
import { http, HttpResponse } from 'msw';

describe('AddCommentForm', () => {
  const mockOnSubmitted = vi.fn();
  const defaultProps = {
    boardId: '123',
    onSubmitted: mockOnSubmitted,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render "Add Comment" button initially', () => {
    render(<AddCommentForm {...defaultProps} />);
    expect(screen.getByRole('button', { name: /\+ add comment/i })).toBeInTheDocument();
  });

  it('should show form when "Add Comment" is clicked', () => {
    render(<AddCommentForm {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /\+ add comment/i }));
    expect(screen.getByPlaceholderText(/write your comment/i)).toBeInTheDocument();
    expect(screen.getByText(/rating \(optional\):/i)).toBeInTheDocument();
  });

  it('should handle successful submission', async () => {
    server.use(
      http.post('*/stickerboards/123/comments', () => {
        return HttpResponse.json({ success: true });
      })
    );

    render(<AddCommentForm {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /\+ add comment/i }));
    
    fireEvent.change(screen.getByPlaceholderText(/write your comment/i), { target: { value: 'Great board!' } });
    fireEvent.change(screen.getByLabelText(/rating \(optional\):/i), { target: { value: '5' } });
    
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(mockOnSubmitted).toHaveBeenCalled();
      expect(screen.queryByPlaceholderText(/write your comment/i)).not.toBeInTheDocument();
    });
  });

  it('should show error message if submission fails', async () => {
    server.use(
      http.post('*/stickerboards/123/comments', () => {
        return HttpResponse.json({ success: false, error: 'Cannot comment on own board' }, { status: 400 });
      })
    );

    render(<AddCommentForm {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /\+ add comment/i }));
    
    fireEvent.change(screen.getByPlaceholderText(/write your comment/i), { target: { value: 'Nice!' } });
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(screen.getByText(/comment failed - cannot comment on own board/i)).toBeInTheDocument();
    });
  });
});
