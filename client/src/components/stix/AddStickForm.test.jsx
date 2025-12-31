import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import AddStickForm from './AddStickForm';
import { server } from '../../test/setup';
import { http, HttpResponse } from 'msw';

describe('AddStickForm', () => {
  const mockOnCreated = vi.fn();
  const defaultProps = {
    boardId: 'test-board-id',
    onCreated: mockOnCreated,
    nextStickNumber: 1,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render form fields', () => {
    render(<AddStickForm {...defaultProps} />);
    expect(screen.getByLabelText(/medicine/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/stick number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/location \*/i)).toBeInTheDocument();
  });

  it('should have submit button disabled when form is invalid', () => {
    render(<AddStickForm {...defaultProps} />);
    const submitBtn = screen.getByRole('button', { name: /add stick/i });
    expect(submitBtn).toBeDisabled();
  });

  it('should enable submit button when required fields are filled', () => {
    render(<AddStickForm {...defaultProps} />);
    
    fireEvent.change(screen.getByLabelText(/location \*/i), { target: { value: 'Arm' } });
    fireEvent.change(screen.getByLabelText(/location modifier \*/i), { target: { value: 'Left' } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Test' } });
    
    const submitBtn = screen.getByRole('button', { name: /add stick/i });
    expect(submitBtn).not.toBeDisabled();
  });

  it('should handle successful submission', async () => {
    server.use(
      http.post('*/stix/test-board-id', () => {
        return HttpResponse.json({ success: true, data: { id: 'new-stick-id' } });
      })
    );

    render(<AddStickForm {...defaultProps} />);
    
    fireEvent.change(screen.getByLabelText(/location \*/i), { target: { value: 'Arm' } });
    fireEvent.change(screen.getByLabelText(/location modifier \*/i), { target: { value: 'Left' } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: 'Test description' } });
    
    fireEvent.click(screen.getByRole('button', { name: /add stick/i }));

    await waitFor(() => {
      expect(mockOnCreated).toHaveBeenCalled();
      expect(screen.getByText(/stick created successfully/i)).toBeInTheDocument();
    });
  });
});
