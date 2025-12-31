import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import StickerPalette from './StickerPalette';

describe('StickerPalette', () => {
  const mockOnSelectSticker = vi.fn();
  const defaultProps = {
    isControlled: true,
    internalStickers: [
      { stickerId: 1, stuck: false },
      { stickerId: 2, stuck: true },
    ],
    isValidStickerId: (id) => id >= 0 && id <= 9,
    isPlacing: false,
    placingIndex: null,
    getStickerSrc: (id) => `/sticker${id}.png`,
    onSelectSticker: mockOnSelectSticker,
  };

  it('should render available stickers in controlled mode', () => {
    render(<StickerPalette {...defaultProps} />);
    expect(screen.getByText(/sticker 1/i)).toBeInTheDocument();
    expect(screen.queryByText(/sticker 2/i)).not.toBeInTheDocument(); // sticker 2 is stuck
  });

  it('should call onSelectSticker when a sticker is clicked', () => {
    render(<StickerPalette {...defaultProps} />);
    // Find button by its title or text content
    fireEvent.click(screen.getByTitle(/click to place this sticker/i));
    expect(mockOnSelectSticker).toHaveBeenCalledWith(0);
  });

  it('should render single sticker button in demo mode', () => {
    render(<StickerPalette {...defaultProps} isControlled={false} />);
    expect(screen.getByText(/sticker 0/i)).toBeInTheDocument();
  });
});
