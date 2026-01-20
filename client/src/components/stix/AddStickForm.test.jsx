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
    server.use(
      http.get('*/stickerboards/test-board-id/stix', () => {
        return HttpResponse.json({ success: true, data: [] });
      })
    );
    render(<AddStickForm {...defaultProps} />);
    expect(screen.getByLabelText(/medicine/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/stick number/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/dose/i)).toBeInTheDocument();
  });

  it('should have submit button disabled by default if no last stick exists', () => {
    server.use(
      http.get('*/stickerboards/test-board-id/stix', () => {
        return HttpResponse.json({ success: true, data: [] });
      })
    );
    render(<AddStickForm {...defaultProps} />);
    const submitBtn = screen.getByRole('button', { name: /add stick/i });
    expect(submitBtn).toBeDisabled();
  });

  it('should enable submit button when medicine is filled (dose has default)', () => {
    server.use(
      http.get('*/stickerboards/test-board-id/stix', () => {
        return HttpResponse.json({ success: true, data: [] });
      })
    );
    render(<AddStickForm {...defaultProps} />);
    
    fireEvent.change(screen.getByLabelText(/medicine/i), { target: { value: 'Ozempic' } });
    
    const submitBtn = screen.getByRole('button', { name: /add stick/i });
    expect(submitBtn).not.toBeDisabled();
  });

  it('should handle successful submission', async () => {
    server.use(
      http.post('*/stix/test-board-id', () => {
        return HttpResponse.json({ success: true, data: { id: 'new-stick-id' } });
      }),
      http.get('*/stickerboards/test-board-id/stix', () => {
        return HttpResponse.json({ success: true, data: [] });
      })
    );

    render(<AddStickForm {...defaultProps} />);
    
    fireEvent.change(screen.getByLabelText(/medicine/i), { target: { value: 'Ozempic' } });
    
    fireEvent.click(screen.getByRole('button', { name: /add stick/i }));

    await waitFor(() => {
      expect(mockOnCreated).toHaveBeenCalled();
      expect(screen.getByText(/stick created successfully/i)).toBeInTheDocument();
    });
  });

  it('should prepopulate from last stick', async () => {
    server.use(
      http.get('*/stickerboards/test-board-id/stix', () => {
        return HttpResponse.json({ 
          success: true, 
          data: [{ stickMed: 'Mounjaro', stickDose: 5.0, stickNumber: 1 }] 
        });
      })
    );

    render(<AddStickForm {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByLabelText(/medicine/i).value).toBe('Mounjaro');
      expect(screen.getByLabelText(/dose/i).value).toBe('5');
    });

    const submitBtn = screen.getByRole('button', { name: /add stick/i });
    expect(submitBtn).not.toBeDisabled();
  });
});
