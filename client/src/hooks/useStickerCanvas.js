import { useCallback, useMemo, useState, useEffect } from "react";
import useImage from "use-image";
import throttle from "lodash.throttle";
import { useBoardAssets } from "./canvas/useBoardAssets";
import { usePlacementState } from "./canvas/usePlacementState";
import { useCanvasPersistence } from "./canvas/useCanvasPersistence";

const EMPTY_ARRAY = [];

export default function useStickerCanvas({
  boardSrc,
  boardId,
  stickers,
  persistedStickers = EMPTY_ARRAY,
  readonly = false,
  displayLongEdge = 600,
  onPlaceSticker,
  onAddSticker,
  isOwner = true,
  cheersStickers = EMPTY_ARRAY,
}) {
  const isCheersMode = !isOwner;
  const isControlled = isCheersMode || Array.isArray(stickers);

  const effectiveInternalStickers = useMemo(() => {
    const boardStickers = Array.isArray(stickers) ? stickers : [];
    if (isCheersMode) {
      const cheers = (cheersStickers || []).map(id => ({ stickerId: id, stuck: false, isCheers: true }));
      return [...boardStickers, ...cheers];
    }
    return boardStickers;
  }, [isCheersMode, cheersStickers, stickers]);

  const [internalStickers, setInternalStickers] = useState(effectiveInternalStickers);
  useEffect(() => { setInternalStickers(effectiveInternalStickers); }, [effectiveInternalStickers]);

  const getStickerSrc = useCallback((stickerId, isCheers) => {
    const cheers = (typeof isCheers === 'boolean') ? isCheers : isCheersMode;
    return cheers ? `/assets/c${stickerId}.png` : `/assets/sticker${stickerId}.png`;
  }, [isCheersMode]);

  const isValidStickerId = useCallback((id) => Number.isInteger(id) && id >= 0 && id <= 9, []);

  const { bgImage, legacyStickerImage, boardSize, legacyDefaultScale } = useBoardAssets(boardSrc, displayLongEdge);

  const {
    isPlacing, setIsPlacing,
    placementStep, setPlacementStep,
    currentPlacement, setCurrentPlacement,
    hoverPos, setHoverPos,
    placingIndex, setPlacingIndex,
    placingSticker,
    enterPlacementMode: baseEnterPlacementMode,
    resetPlacement
  } = usePlacementState(internalStickers, getStickerSrc, isValidStickerId, isControlled);

  const {
    placements,
    persistPlacements,
    finalizeLatestPlacement
  } = useCanvasPersistence(boardId, isControlled, stickers, persistedStickers);

  const [placingImage] = useImage(
    placingSticker?.stickerId != null && isValidStickerId(placingSticker.stickerId)
      ? getStickerSrc(placingSticker.stickerId, placingSticker?.isCheers)
      : null
  );

  const placingDefaultScale = useMemo(() => {
    if (!placingImage) return 1;
    const boardShort = Math.min(boardSize.width, boardSize.height);
    const stickerLong = Math.max(placingImage.width, placingImage.height);
    return Math.min(1, 0.25 * (boardShort / stickerLong));
  }, [boardSize, placingImage]);

  const enterPlacementMode = useCallback((index) => {
    if (readonly) return;
    if (isControlled) {
      if (index != null) baseEnterPlacementMode(index);
    } else if (legacyStickerImage) {
      setIsPlacing(true);
      setPlacementStep('POSITION');
    }
  }, [readonly, isControlled, baseEnterPlacementMode, legacyStickerImage, setIsPlacing, setPlacementStep]);

  const updateHoverPos = useCallback((pos) => {
    setHoverPos({
      x: Math.max(0, Math.min(pos.x, boardSize.width)),
      y: Math.max(0, Math.min(pos.y, boardSize.height))
    });

    if (isPlacing && currentPlacement) {
      const dx = pos.x - currentPlacement.x;
      const dy = pos.y - currentPlacement.y;
      if (placementStep === 'SCALE') {
        const dist = Math.sqrt(dx * dx + dy * dy);
        setCurrentPlacement(prev => ({ ...prev, scale: prev.baseScale * Math.max(0.1, dist / 100) }));
      } else if (placementStep === 'ROTATE') {
        setCurrentPlacement(prev => ({ ...prev, rotation: Math.atan2(dy, dx) * (180 / Math.PI) }));
      }
    }
  }, [boardSize, isPlacing, currentPlacement, placementStep, setHoverPos, setCurrentPlacement]);

  const throttledUpdateHoverPos = useMemo(() => throttle(updateHoverPos, 16), [updateHoverPos]);
  useEffect(() => () => throttledUpdateHoverPos.cancel(), [throttledUpdateHoverPos]);

  const onStageMouseMove = useCallback((e) => {
    if (!isPlacing) return;
    const pos = e.target.getStage()?.getPointerPosition();
    if (pos) throttledUpdateHoverPos(pos);
  }, [isPlacing, throttledUpdateHoverPos]);

  const placeSticker = useCallback(async (e) => {
    if (!isPlacing) return;
    const pos = e.target.getStage()?.getPointerPosition();
    if (!pos) return;

    if (pos.x < 0 || pos.x > boardSize.width || pos.y < 0 || pos.y > boardSize.height) {
      resetPlacement();
      return;
    }

    if (placementStep === 'POSITION') {
      setCurrentPlacement({
        x: pos.x,
        y: pos.y,
        baseScale: isControlled ? placingDefaultScale : legacyDefaultScale,
        scale: isControlled ? placingDefaultScale : legacyDefaultScale,
        rotation: 0
      });
      setPlacementStep('SCALE');
      return;
    }

    if (placementStep === 'SCALE') {
      setPlacementStep('ROTATE');
      return;
    }

    const xNorm = currentPlacement.x / boardSize.width;
    const yNorm = currentPlacement.y / boardSize.height;

    if (isControlled) {
      const original = internalStickers?.[placingIndex];
      if (!original) return;

      const maxZ = internalStickers
          .filter(s => s?.stuck)
          .reduce((m, s) => Math.max(m, s.zIndex || 0), 0);

      const placedSticker = {
        ...original,
        x: xNorm,
        y: yNorm,
        scale: currentPlacement.scale,
        rotation: currentPlacement.rotation,
        zIndex: maxZ + 1,
        stuck: true,
        createdAt: original.createdAt || new Date().toISOString(),
      };

      const next = internalStickers.map((s, i) => (i === placingIndex ? placedSticker : s));
      setInternalStickers(next);
      resetPlacement();

      if (onPlaceSticker) {
        await onPlaceSticker(isOwner ? next : next.filter(s => s.stuck), placedSticker, placingIndex);
      }
    } else {
      const next = [...placements, {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        xNorm, yNorm,
        scale: currentPlacement.scale,
        rotation: currentPlacement.rotation,
        asset: "/assets/sticker0.png",
      }];
      persistPlacements(next);
      resetPlacement();
      if (onAddSticker) onAddSticker(next[next.length - 1]);
    }
  }, [isPlacing, boardSize, isControlled, internalStickers, placingIndex, placingDefaultScale, placements, persistPlacements, onAddSticker, legacyDefaultScale, onPlaceSticker, placementStep, currentPlacement, resetPlacement, isOwner, setCurrentPlacement, setPlacementStep]);

  return {
    bgImage, legacyStickerImage, placingImage,
    isPlacing, hoverPos, boardSize,
    internalStickers, placingIndex, placingDefaultScale, legacyDefaultScale,
    placements, isControlled, getStickerSrc, isValidStickerId,
    enterPlacementMode, onStageMouseMove, placeSticker,
    persistPlacements, finalizeLatestPlacement,
    placementStep, currentPlacement, isCheersMode, cheersStickers
  };
}