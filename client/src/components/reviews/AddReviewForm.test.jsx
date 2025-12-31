import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import AddReviewForm from './AddReviewForm';
import { server } from '../../test/setup';
import { http, HttpResponse } from 'msw';

describe('AddReviewForm', () => {
  const mockOnSubmitted = vi.fn();
  const defaultProps = {
    boardId: '123',
    onSubmitted: mockOnSubmitted,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render "Add Comment" button initially', () => {
    render(<AddReviewForm {...defaultProps} />);
    expect(screen.getByRole('button', { name: /\+ add comment/i })).toBeInTheDocument();
  });

  it('should show form when "Add Comment" is clicked', () => {
    render(<AddReviewForm {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /\+ add comment/i }));
    expect(screen.getByPlaceholderText(/write your comment/i)).toBeInTheDocument();
    expect(screen.getByText(/rating \(optional\):/i)).toBeInTheDocument();
  });

  it('should handle successful submission', async () => {
    server.use(
      http.post('*/stickerboards/123/reviews', () => {
        return HttpResponse.json({ success: true });
      })
    );

    render(<AddReviewForm {...defaultProps} />);
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
      http.post('*/stickerboards/123/reviews', () => {
        return HttpResponse.json({ success: false, error: 'Cannot review own board' }, { status: 400 });
      })
    );

    render(<AddReviewForm {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /\+ add comment/i }));
    
    fireEvent.change(screen.getByPlaceholderText(/write your comment/i), { target: { value: 'Nice!' } });
    fireEvent.click(screen.getByRole('button', { name: /submit/i }));

    await waitFor(() => {
      expect(screen.getByText(/cannot review own board/i)).toBeInTheDocument();
    });
  });
});
