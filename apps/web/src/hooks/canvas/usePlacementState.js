import { useState, useCallback, useMemo } from 'react';

export function usePlacementState(internalStickers, getStickerSrc, isValidStickerId, isControlled) {
  const [isPlacing, setIsPlacing] = useState(false);
  const [placementStep, setPlacementStep] = useState('POSITION');
  const [currentPlacement, setCurrentPlacement] = useState(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });
  const [placingIndex, setPlacingIndex] = useState(null);

  const placingSticker = useMemo(() => {
    if (!isControlled || placingIndex == null) return null;
    return internalStickers?.[placingIndex] || null;
  }, [isControlled, placingIndex, internalStickers]);

  const enterPlacementMode = useCallback((idx) => {
    setPlacingIndex(idx);
    setIsPlacing(true);
    setPlacementStep('POSITION');
    setCurrentPlacement(null);
  }, []);

  const resetPlacement = useCallback(() => {
    setIsPlacing(false);
    setPlacingIndex(null);
    setCurrentPlacement(null);
    setPlacementStep('POSITION');
  }, []);

  return {
    isPlacing, setIsPlacing,
    placementStep, setPlacementStep,
    currentPlacement, setCurrentPlacement,
    hoverPos, setHoverPos,
    placingIndex, setPlacingIndex,
    placingSticker,
    enterPlacementMode,
    resetPlacement
  };
}
