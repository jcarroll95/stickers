import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import StickerPalette from './StickerPalette.jsx';
import { useStickerInventory } from '../../hooks/useStickerInventory.js';

// Mock the hook
vi.mock('../../hooks/useStickerInventory', () => ({
  useStickerInventory: vi.fn()
}));

// Mock the CSS module
vi.mock('./StickerInterface.module.css', () => ({
  default: {
    stickerPalette: 'stickerPalette',
    stickerGrid: 'stickerGrid',
    stickerIcon: 'stickerIcon',
    available: 'available',
    consumed: 'consumed',
    stickerImage: 'stickerImage',
    stickerName: 'stickerName',
    stickerCount: 'stickerCount',
    stickerPaletteTabs: 'stickerPaletteTabs',
    tabButton: 'tabButton',
    active: 'active',
    loading: 'loading',
    noStickers: 'noStickers'
  }
}));

describe('StickerPalette', () => {
  const mockFetchUserStickerInventory = vi.fn();
  const mockAwardSticker = vi.fn();
  const mockRevokeSticker = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    useStickerInventory.mockReturnValue({
      fetchUserStickerInventory: mockFetchUserStickerInventory,
      awardSticker: mockAwardSticker,
      revokeSticker: mockRevokeSticker,
      loading: false,
      inventory: []
    });
  });

  it('should show loading state initially', () => {
    useStickerInventory.mockReturnValue({
      fetchUserStickerInventory: mockFetchUserStickerInventory,
      loading: true,
      inventory: []
    });
    
    render(<StickerPalette userId="user1" />);
    expect(screen.getByText(/loading stickers.../i)).toBeInTheDocument();
  });

  it('should fetch inventory when userId is provided', async () => {
    mockFetchUserStickerInventory.mockResolvedValue([]);
    
    render(<StickerPalette userId="user1" />);
    
    await waitFor(() => {
      expect(mockFetchUserStickerInventory).toHaveBeenCalledWith('user1');
    });
  });

  it('should render "No stickers available" when inventory is empty', async () => {
    mockFetchUserStickerInventory.mockResolvedValue([]);
    
    render(<StickerPalette userId="user1" />);
    
    await waitFor(() => {
      expect(screen.getByText(/no stickers available/i)).toBeInTheDocument();
    });
  });

  it('should call onStickerSelect when an available sticker is clicked', async () => {
    const mockInventory = [
      { id: 's1', name: 'Sticker 1', imageUrl: 'url1', packId: 'pack1', packName: 'Pack 1', quantity: 1 }
    ];
    mockFetchUserStickerInventory.mockResolvedValue(mockInventory);
    const onStickerSelect = vi.fn();
    
    render(<StickerPalette userId="user1" onStickerSelect={onStickerSelect} />);
    
    const sticker = await screen.findByTitle('Sticker 1');
    sticker.click();
    
    expect(onStickerSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 's1' }));
  });

  it('should not call onStickerSelect when a consumed sticker is clicked', async () => {
    const mockInventory = [
      { id: 's1', name: 'Sticker 1', imageUrl: 'url1', packId: 'pack1', packName: 'Pack 1', quantity: 0 }
    ];
    mockFetchUserStickerInventory.mockResolvedValue(mockInventory);
    const onStickerSelect = vi.fn();
    
    render(<StickerPalette userId="user1" onStickerSelect={onStickerSelect} />);
    
    const sticker = await screen.findByTitle('Sticker 1');
    sticker.click();
    
    expect(onStickerSelect).not.toHaveBeenCalled();
  });
});
