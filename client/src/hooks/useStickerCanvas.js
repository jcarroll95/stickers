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
      const cheers = (cheersStickers || []).map((id, index) => ({
        stickerId: id,
        stuck: false,
        isCheers: true,
        tempId: `cheers-${index}-${id}`
      }));
      return [...boardStickers, ...cheers];
    }
    return boardStickers;
  }, [isCheersMode, cheersStickers, stickers]);

  const [internalStickers, setInternalStickers] = useState(effectiveInternalStickers);
  useEffect(() => {
    console.log('Updating internalStickers, cheersStickers:', cheersStickers);
    setInternalStickers(effectiveInternalStickers);
  }, [effectiveInternalStickers]);

  const assetsBaseUrl = import.meta.env.VITE_ASSETS_BASE_URL || '/assets';

  const getStickerSrc = useCallback((stickerId, isCheers, entry) => {
    const cheers = (typeof isCheers === 'boolean') ? isCheers : isCheersMode;
    
    // 1. If we have an explicit imageUrl in the entry, use it (newly persisted boards)
    if (entry?.imageUrl) {
      console.log('getStickerSrc using entry.imageUrl:', entry.imageUrl);
      return entry.imageUrl;
    }

    // 2. If stickerId is an ObjectId (24 hex chars), it should be from the inventory system
    if (typeof stickerId === 'string' && stickerId.match(/^[0-9a-fA-F]{24}$/)) {
      // Search in internalStickers/stickers (might have the URL if it's currently being placed or was just loaded)
      const found = [...(internalStickers || []), ...(stickers || [])].find(s => (s.stickerId === stickerId || s.id === stickerId) && s.imageUrl);
      if (found) {
        console.log('getStickerSrc found imageUrl in state for:', stickerId);
        return found.imageUrl;
      }
      
      console.warn('getStickerSrc could not resolve URL for inventory sticker:', stickerId);
      return null;
    }
    return cheers ? `${assetsBaseUrl}/c${stickerId}.png` : `${assetsBaseUrl}/sticker${stickerId}.png`;
  }, [isCheersMode, assetsBaseUrl, internalStickers, stickers]);

  const isValidStickerId = useCallback((id, isCheers) => {
    if (typeof id === 'string' && id.match(/^[0-9a-fA-F]{24}$/)) return true;
    const num = Number(id);
    if (!Number.isInteger(num) || num < 0) return false;
    return isCheers ? num <= 10000 : num <= 9;
  }, []);

  const { bgImage, bgStatus, legacyStickerImage, boardSize, legacyDefaultScale } = useBoardAssets(boardSrc, displayLongEdge);

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

  const [placingInventorySticker, setPlacingInventorySticker] = useState(null);

  const [placingImage] = useImage(
    placingInventorySticker 
      ? placingInventorySticker.imageUrl 
      : (placingSticker?.stickerId != null && isValidStickerId(placingSticker.stickerId)
          ? getStickerSrc(placingSticker.stickerId, placingSticker?.isCheers)
          : null),
    'anonymous'
  );

  const placingDefaultScale = useMemo(() => {
    if (!placingImage) return 1;
    const boardShort = Math.min(boardSize.width, boardSize.height);
    const stickerLong = Math.max(placingImage.width, placingImage.height);
    return Math.min(1, 0.25 * (boardShort / stickerLong));
  }, [boardSize, placingImage]);

  const enterPlacementMode = useCallback((item) => {
    if (readonly) return;
    
    // Check if item is an index (for controlled board stix) or an inventory object
    if (typeof item === 'number') {
      if (isControlled) {
        baseEnterPlacementMode(item);
      }
    } else if (item && typeof item === 'object') {
      // Inventory sticker placement
      setPlacingInventorySticker(item);
      setIsPlacing(true);
      setPlacementStep('POSITION');
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
      // NOTE: resetPlacement is also called by global click listener in StickerInterface
      // for clicks outside the canvas. This check handles clicks that might still be 
      // within the Konva Stage but outside the board bounds.
      resetPlacement();
      setPlacingInventorySticker(null);
      return;
    }

    if (placementStep === 'POSITION') {
      setCurrentPlacement({
        x: pos.x,
        y: pos.y,
        baseScale: (isControlled && !placingInventorySticker) ? placingDefaultScale : legacyDefaultScale,
        scale: (isControlled && !placingInventorySticker) ? placingDefaultScale : legacyDefaultScale,
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

    if (placingInventorySticker) {
      // Placing from inventory
      const maxZ = (stickers || [])
        .filter(s => s?.stuck)
        .reduce((m, s) => Math.max(m, s.zIndex || 0), 0);

      const placedSticker = {
        stickerId: placingInventorySticker.id,
        imageUrl: placingInventorySticker.imageUrl,
        name: placingInventorySticker.name,
        x: xNorm,
        y: yNorm,
        scale: currentPlacement.scale,
        rotation: currentPlacement.rotation,
        zIndex: maxZ + 1,
        stuck: true,
        createdAt: new Date().toISOString(),
      };

      resetPlacement();
      setPlacingInventorySticker(null);
      if (onPlaceSticker) {
        await onPlaceSticker([...(stickers || []), placedSticker], placedSticker, -1);
      }
      return;
    }

    if (isControlled) {
      const original = internalStickers?.[placingIndex];
      if (!original) return;

      const maxZ = (isOwner ? internalStickers : (stickers || []))
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

      if (isOwner) {
        const next = internalStickers.map((s, i) => (i === placingIndex ? placedSticker : s));
        setInternalStickers(next);
        resetPlacement();
        if (onPlaceSticker) {
            await onPlaceSticker(next, placedSticker, placingIndex);
        }
      } else {
        resetPlacement();
        if (onPlaceSticker) {
            // In Cheers mode, we don't send the full list from local state, 
            // the backend just needs to know which sticker is being added.
            // BoardView.jsx onPlace will send { stickers: next } to the backend.
            // We pass the new sticker as part of a minimal "next" array or similar 
            // if BoardView expects it to be the "full" list, but actually 
            // BoardView.jsx's onPlace implementation just sends whatever we pass as 'next'.
            
            // To simplify and ensure atomicity on backend:
            // The backend expects an array that is LONGER than current board stickers.
            await onPlaceSticker([...(stickers || []), placedSticker], placedSticker, placingIndex);
        }
      }
    } else {
      const next = [...placements, {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        xNorm, yNorm,
        scale: currentPlacement.scale,
        rotation: currentPlacement.rotation,
        asset: `${assetsBaseUrl}/sticker0.png`,
      }];
      persistPlacements(next);
      resetPlacement();
      if (onAddSticker) onAddSticker(next[next.length - 1]);
    }
  }, [isPlacing, boardSize, isControlled, internalStickers, placingIndex, placingDefaultScale, placements, persistPlacements, onAddSticker, legacyDefaultScale, onPlaceSticker, placementStep, currentPlacement, resetPlacement, isOwner, setCurrentPlacement, setPlacementStep]);

  return {
    bgImage, bgStatus, legacyStickerImage, placingImage,
    isPlacing, hoverPos, boardSize,
    internalStickers, placingIndex, placingDefaultScale, legacyDefaultScale,
    placements, isControlled, getStickerSrc, isValidStickerId,
    enterPlacementMode, onStageMouseMove, placeSticker,
    persistPlacements, finalizeLatestPlacement, resetPlacement,
    placementStep, currentPlacement, isCheersMode, cheersStickers
  };
}