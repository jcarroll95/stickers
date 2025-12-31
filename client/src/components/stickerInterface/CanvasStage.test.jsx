import React from 'react';
import { render } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import CanvasStage from './CanvasStage';

// Mock use-image to return a fake image object
vi.mock('use-image', () => ({
  default: vi.fn(() => [{ width: 1000, height: 1000 }]),
}));

// react-konva needs to be mocked or handled carefully in JSDOM
// vitest-canvas-mock helps, but sometimes we need to mock Stage/Layer if it's too heavy
vi.mock('react-konva', () => ({
  Stage: ({ children }) => <div data-testid="konva-stage">{children}</div>,
  Layer: ({ children }) => <div data-testid="konva-layer">{children}</div>,
  Image: (props) => <div data-testid="konva-image" {...props} />,
}));

describe('CanvasStage', () => {
  const defaultProps = {
    boardSize: { width: 600, height: 400 },
    bgImage: { width: 1000, height: 1000 },
    isControlled: true,
    internalStickers: [{ stickerId: 1, x: 0.5, y: 0.5, stuck: true }],
    placements: [],
    persistedStickers: [],
    legacyDefaultScale: 1,
    legacyStickerImage: null,
    isPlacing: false,
    placingImage: null,
    placingDefaultScale: 1,
    hoverPos: { x: 0, y: 0 },
    displayLongEdge: 600,
    getStickerSrc: (id) => `/sticker${id}.png`,
    isValidStickerId: (id) => id >= 0 && id <= 9,
    onMouseMove: vi.fn(),
    onClick: vi.fn(),
    stageRef: { current: null },
  };

  it('should render the Konva stage and layer', () => {
    const { getByTestId } = render(<CanvasStage {...defaultProps} />);
    expect(getByTestId('konva-stage')).toBeInTheDocument();
    expect(getByTestId('konva-layer')).toBeInTheDocument();
  });

  it('should render placed stickers in controlled mode', () => {
    const { getAllByTestId } = render(<CanvasStage {...defaultProps} />);
    // One for background, one for the placed sticker
    expect(getAllByTestId('konva-image')).toHaveLength(2);
  });

  it('should render hover sticker when placing', () => {
    const props = {
      ...defaultProps,
      isPlacing: true,
      placingImage: { width: 100, height: 100 },
    };
    const { getAllByTestId } = render(<CanvasStage {...props} />);
    // Background, placed sticker, and hover sticker
    expect(getAllByTestId('konva-image')).toHaveLength(3);
  });
});
