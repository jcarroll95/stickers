import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import useStickerCanvas from './useStickerCanvas';

// Mock use-image to return a fake image object
vi.mock('use-image', () => ({
  default: vi.fn(() => [{ width: 1000, height: 1000 }]),
}));

describe('useStickerCanvas', () => {
  const defaultProps = {
    boardSrc: '/assets/sb0.png',
    boardId: 'test-board',
    displayLongEdge: 1000,
  };

  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should calculate boardSize correctly based on displayLongEdge', () => {
    const { result } = renderHook(() => useStickerCanvas(defaultProps));
    expect(result.current.boardSize).toEqual({ width: 1000, height: 1000 });
  });

  it('should enter placement mode', () => {
    const { result } = renderHook(() => useStickerCanvas(defaultProps));
    
    act(() => {
      result.current.enterPlacementMode(null);
    });

    expect(result.current.isPlacing).toBe(true);
  });

  it('should handle stage mouse move', () => {
    const { result } = renderHook(() => useStickerCanvas(defaultProps));
    
    act(() => {
      result.current.enterPlacementMode(null);
    });

    const mockEvent = {
      target: {
        getStage: () => ({
          getPointerPosition: () => ({ x: 500, y: 500 }),
        }),
      },
    };

    act(() => {
      result.current.onStageMouseMove(mockEvent);
    });

    expect(result.current.hoverPos).toEqual({ x: 500, y: 500 });
  });

  it('should place a sticker in demo mode (uncontrolled)', () => {
    const { result } = renderHook(() => useStickerCanvas(defaultProps));
    
    act(() => {
      result.current.enterPlacementMode(null);
    });

    const mockEvent = {
      target: {
        getStage: () => ({
          getPointerPosition: () => ({ x: 100, y: 200 }),
        }),
      },
    };

    act(() => {
      result.current.placeSticker(mockEvent);
    });

    expect(result.current.isPlacing).toBe(false);
    expect(result.current.placements).toHaveLength(1);
    expect(result.current.placements[0]).toMatchObject({
      xNorm: 0.1,
      yNorm: 0.2,
    });
  });

  it('should place a sticker in controlled mode', () => {
    const onPlaceSticker = vi.fn();
    const props = {
      ...defaultProps,
      stickers: [{ stickerId: 1, stuck: false }],
      onPlaceSticker,
    };

    const { result } = renderHook(() => useStickerCanvas(props));
    
    act(() => {
      result.current.enterPlacementMode(0);
    });

    const mockEvent = {
      target: {
        getStage: () => ({
          getPointerPosition: () => ({ x: 500, y: 500 }),
        }),
      },
    };

    act(() => {
      result.current.placeSticker(mockEvent);
    });

    expect(result.current.isPlacing).toBe(false);
    expect(onPlaceSticker).toHaveBeenCalled();
    const nextStickers = onPlaceSticker.mock.calls[0][0];
    expect(nextStickers[0].stuck).toBe(true);
    expect(nextStickers[0].x).toBe(0.5);
    expect(nextStickers[0].y).toBe(0.5);
  });
});
