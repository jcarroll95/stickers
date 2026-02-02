import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import BoardSidebar from './BoardSidebar.jsx';

describe('BoardSidebar', () => {
  const mockOnClear = vi.fn();
  const mockOnFinalize = vi.fn();
  const defaultProps = {
    isControlled: false,
    placements: [{ id: '1', xNorm: 0.1, yNorm: 0.1 }],
    onClear: mockOnClear,
    onFinalize: mockOnFinalize,
    canFinalize: true,
  };

  it('should render buttons in demo mode', () => {
    render(<BoardSidebar {...defaultProps} />);
    expect(screen.getByRole('button', { name: /clear stickers/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /finalize last sticker/i })).toBeInTheDocument();
  });

  it('should not render anything in controlled mode', () => {
    const { container } = render(<BoardSidebar {...defaultProps} isControlled={true} />);
    expect(container.firstChild).toBeNull();
  });

  it('should call onClear when clear button is clicked', () => {
    render(<BoardSidebar {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /clear stickers/i }));
    expect(mockOnClear).toHaveBeenCalled();
  });

  it('should call onFinalize when finalize button is clicked', () => {
    render(<BoardSidebar {...defaultProps} />);
    fireEvent.click(screen.getByRole('button', { name: /finalize last sticker/i }));
    expect(mockOnFinalize).toHaveBeenCalled();
  });

  it('should disable finalize button when canFinalize is false', () => {
    render(<BoardSidebar {...defaultProps} canFinalize={false} />);
    expect(screen.getByRole('button', { name: /finalize last sticker/i })).toBeDisabled();
  });
});
