import { useCallback, useMemo, useState, useEffect } from "react";
import useImage from "use-image";
import throttle from "lodash.throttle";
import apiClient from "../services/apiClient";

/**
 * useStickerCanvas Hook
 * 
 * Encapsulates all logic for the interactive stickerboard:
 * - Image loading for board and stickers
 * - Placement state and hover tracking
 * - Coordinate normalization and clamping
 * - Support for both 'controlled' (backend-driven) and 'demo' (localStorage) modes.
 * 
 * @param {Object} props - Hook properties
 * @param {string} props.boardSrc - Source URL for the board background image
 * @param {string|number} props.boardId - Unique identifier for the board (used for persistence)
 * @param {Array<Object>} [props.stickers] - Optional array of sticker objects (controlled mode)
 * @param {Array<Object>} [props.persistedStickers=[]] - Stickers already saved to the backend
 * @param {boolean} [props.readonly=false] - If true, disables placement interactions
 * @param {number|string} [props.displayLongEdge=600] - Target length for the longest edge of the board
 * @param {Function} [props.onPlaceSticker] - Callback fired when a sticker is placed in controlled mode
 * @param {Function} [props.onAddSticker] - Callback fired when a sticker is placed in demo mode
 * 
 * @returns {Object} {
 *   bgImage, legacyStickerImage, placingImage, isPlacing, hoverPos, boardSize,
 *   internalStickers, placingIndex, placingDefaultScale, legacyDefaultScale,
 *   placements, isControlled, getStickerSrc, isValidStickerId,
 *   enterPlacementMode, onStageMouseMove, placeSticker, persistPlacements,
 *   finalizeLatestPlacement
 * }
 */
export default function useStickerCanvas({
  boardSrc,
  boardId,
  stickers,
  persistedStickers = [],
  readonly = false,
  displayLongEdge = 600,
  onPlaceSticker,
  onAddSticker,
  isOwner = true,
  cheersStickers = [],
}) {
  const [bgImage] = useImage(boardSrc);
  const [legacyStickerImage] = useImage("/assets/sticker0.png");

  const [isPlacing, setIsPlacing] = useState(false);
  const [placementStep, setPlacementStep] = useState('POSITION'); // 'POSITION', 'SCALE', 'ROTATE'
  const [currentPlacement, setCurrentPlacement] = useState(null);
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 });

  // Cheers Mode logic
  const isCheersMode = !isOwner;
  const effectiveInternalStickers = useMemo(() => {
    const boardStickers = Array.isArray(stickers) ? stickers : [];
    if (isCheersMode) {
      // For Cheers! mode, we need to show existing stickers (stuck) 
      // AND provide the user's available cheers stickers (not stuck) for placement.
      const cheers = (cheersStickers || []).map(id => ({ stickerId: id, stuck: false, isCheers: true }));
      return [...boardStickers, ...cheers];
    }
    return boardStickers;
  }, [isCheersMode, cheersStickers, stickers]);

  // Helper: map stickerId (0..9) to asset path
  const getStickerSrc = useCallback((stickerId, isCheers) => {
    // If isCheers is provided (from the sticker object), use it.
    // Otherwise fallback to global isCheersMode (useful for palette/initial placement)
    const cheers = (typeof isCheers === 'boolean') ? isCheers : isCheersMode;
    if (cheers) {
      return `/assets/c${stickerId}.png`;
    }
    return `/assets/sticker${stickerId}.png`;
  }, [isCheersMode]);

  const isValidStickerId = useCallback((id, isCheers) => {
    const cheers = (typeof isCheers === 'boolean') ? isCheers : isCheersMode;
    return Number.isInteger(id) && id >= 0 && id <= 9;
  }, [isCheersMode]);

  // Internal unified stickers state for controlled mode (optimistic updates)
  const [internalStickers, setInternalStickers] = useState(effectiveInternalStickers);
  const isControlled = isCheersMode || Array.isArray(stickers);

  // Synchronize internalStickers if prop changes
  useEffect(() => {
    setInternalStickers(effectiveInternalStickers);
  }, [effectiveInternalStickers]);

  // Selection (for controlled mode): which sticker entry (by index in internalStickers) is being placed
  const [placingIndex, setPlacingIndex] = useState(null);
  
  const placingSticker = useMemo(() => {
    if (!isControlled || placingIndex == null) return null;
    return internalStickers?.[placingIndex] || null;
  }, [isControlled, placingIndex, internalStickers]);

  const placingStickerId = placingSticker?.stickerId;
  const [placingImage] = useImage(
    placingStickerId != null && isValidStickerId(placingStickerId, placingSticker?.isCheers)
      ? getStickerSrc(placingStickerId, placingSticker?.isCheers)
      : null
  );

  // Board render dimensions
  const boardSize = useMemo(() => {
    const TARGET_LONG_EDGE = Math.max(1, Number(displayLongEdge) || 600);
    if (bgImage && bgImage.width && bgImage.height) {
      const iw = bgImage.width;
      const ih = bgImage.height;
      const long = Math.max(iw, ih);
      const scale = TARGET_LONG_EDGE / long;
      return { width: Math.round(iw * scale), height: Math.round(ih * scale) };
    }
    return { width: TARGET_LONG_EDGE, height: TARGET_LONG_EDGE };
  }, [bgImage, displayLongEdge]);

  // Default scales
  const legacyDefaultScale = useMemo(() => {
    if (!legacyStickerImage) return 1;
    const boardShort = Math.min(boardSize.width, boardSize.height);
    const stickerLong = Math.max(legacyStickerImage.width, legacyStickerImage.height);
    if (!boardShort || !stickerLong) return 1;
    return Math.min(1, 0.35 * (boardShort / stickerLong));
  }, [boardSize, legacyStickerImage]);

  const placingDefaultScale = useMemo(() => {
    if (!placingImage) return 1;
    const boardShort = Math.min(boardSize.width, boardSize.height);
    const stickerLong = Math.max(placingImage.width, placingImage.height);
    if (!boardShort || !stickerLong) return 1;
    return Math.min(1, 0.25 * (boardShort / stickerLong));
  }, [boardSize, placingImage]);

  // Demo mode persistence
  const storageKey = useMemo(() => `stickerboard:${boardId}:placements`, [boardId]);
  const [placements, setPlacements] = useState(() => {
    if (Array.isArray(stickers)) return []; // isControlled
    try {
      const raw = localStorage.getItem(`stickerboard:${boardId}:placements`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.error("[useStickerCanvas] LocalStorage initial read failed:", e);
    }
    return [];
  });

  const persistPlacements = useCallback((next) => {
    if (isControlled) return;
    setPlacements(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch (e) {
      console.error("[useStickerCanvas] LocalStorage write failed:", e);
    }
  }, [storageKey, isControlled]);

  const finalizeLatestPlacement = useCallback(async () => {
    if (isControlled) return;
    const lastPlacement = placements[placements.length - 1];
    if (!lastPlacement) return;
    
    // Check if the last placement is actually finished (it won't be in placements until it's finalized)
    // Actually, in the new flow, the placement is ONLY pushed to placements on the final click.
    // So finalizeLatestPlacement should still work for the last one in the list.
    
    try {
      const persisted = Array.isArray(persistedStickers) ? persistedStickers : [];
      const maxZ = persisted
        .filter((s) => s && s.stuck)
        .reduce((m, s) => (typeof s.zIndex === 'number' ? Math.max(m, s.zIndex) : m), 0);
      const nextZ = (Number.isFinite(maxZ) ? maxZ : 0) + 1;

      const stickerDoc = {
        stickerId: 0,
        x: lastPlacement.xNorm,
        y: lastPlacement.yNorm,
        scale: typeof lastPlacement.scale === 'number' ? lastPlacement.scale : legacyDefaultScale,
        rotation: lastPlacement.rotation || 0,
        zIndex: nextZ,
        stuck: true,
        createdAt: new Date().toISOString(),
      };

      await apiClient.put(`/stickerboards/${encodeURIComponent(boardId)}`, {
        $push: { stickers: stickerDoc },
      });

      persistPlacements([]);
      window.dispatchEvent(new CustomEvent('stickerboard:finalized', { detail: { boardId, sticker: stickerDoc } }));
    } catch (err) {
      console.error('[useStickerCanvas] Finalize failed:', err);
      const errorMsg = err.response?.data?.error || err.message || String(err);
      alert(`Failed to finalize sticker: ${errorMsg}`);
    }
  }, [isControlled, placements, persistedStickers, legacyDefaultScale, boardId, persistPlacements]);

  // Handlers
  const enterPlacementMode = useCallback((index) => {
    if (readonly) return;
    setPlacementStep('POSITION');
    setCurrentPlacement(null);
    if (isControlled) {
      if (index == null) return;
      setPlacingIndex(index);
      setIsPlacing(true);
    } else {
      if (!legacyStickerImage) return;
      setIsPlacing(true);
    }
  }, [isControlled, legacyStickerImage, readonly]);

  const updateHoverPos = useCallback((pos) => {
    setHoverPos({
      x: Math.max(0, Math.min(pos.x, boardSize.width)),
      y: Math.max(0, Math.min(pos.y, boardSize.height))
    });

    if (isPlacing && currentPlacement) {
      if (placementStep === 'SCALE') {
        const dx = pos.x - currentPlacement.x;
        const dy = pos.y - currentPlacement.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        // Scale is a multiplier of distance. 
        // We'll use a sensitivity factor so it's intuitive.
        // If distance is 0, scale is small (or default).
        // Let's say 100px = 1.0 scale multiplier above default.
        const scaleMultiplier = Math.max(0.1, dist / 100);
        setCurrentPlacement(prev => ({ ...prev, scale: prev.baseScale * scaleMultiplier }));
      } else if (placementStep === 'ROTATE') {
        const dx = pos.x - currentPlacement.x;
        const dy = pos.y - currentPlacement.y;
        // Calculate angle in degrees
        const angle = Math.atan2(dy, dx) * (180 / Math.PI);
        setCurrentPlacement(prev => ({ ...prev, rotation: angle }));
      }
    }
  }, [boardSize, isPlacing, currentPlacement, placementStep]);

  const throttledUpdateHoverPos = useMemo(
    () => throttle(updateHoverPos, 16),
    [updateHoverPos]
  );

  useEffect(() => {
    return () => {
      throttledUpdateHoverPos.cancel();
    };
  }, [throttledUpdateHoverPos]);

  const onStageMouseMove = useCallback((e) => {
    if (!isPlacing) return;
    const stage = e.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return;
    throttledUpdateHoverPos(pos);
  }, [isPlacing, throttledUpdateHoverPos]);

  const placeSticker = useCallback((e) => {
    if (!isPlacing) return;
    const stage = e.target.getStage();
    const pos = stage?.getPointerPosition();
    if (!pos) return;

    const withinX = pos.x >= 0 && pos.x <= boardSize.width;
    const withinY = pos.y >= 0 && pos.y <= boardSize.height;

    if (!withinX || !withinY) {
      setIsPlacing(false);
      setPlacingIndex(null);
      setPlacementStep('POSITION');
      setCurrentPlacement(null);
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

    // placementStep === 'ROTATE' -> Finalize
    const xNorm = currentPlacement.x / boardSize.width;
    const yNorm = currentPlacement.y / boardSize.height;

    if (isControlled) {
      if (placingIndex == null || !Array.isArray(internalStickers)) return;
      const original = internalStickers[placingIndex];
      if (!original) return;

      const maxZ = internalStickers
          .filter((s) => s && s.stuck)
          .reduce((m, s) => (typeof s.zIndex === 'number' ? Math.max(m, s.zIndex) : m), 0);
      const nextZ = (Number.isFinite(maxZ) ? maxZ : 0) + 1;

      const placedSticker = {
        ...original,
        x: xNorm,
        y: yNorm,
        scale: currentPlacement.scale,
        rotation: currentPlacement.rotation,
        zIndex: nextZ,
        stuck: true,
        createdAt: original.createdAt || new Date().toISOString(),
      };

      const next = internalStickers.map((s, i) => (i === placingIndex ? placedSticker : s));
      setInternalStickers(next);
      setIsPlacing(false);
      setPlacingIndex(null);
      setPlacementStep('POSITION');
      setCurrentPlacement(null);

      if (onPlaceSticker) {
        // Only send stickers that are actually stuck to the backend
        const onlyStuck = next.filter(s => s.stuck);
        onPlaceSticker(onlyStuck, placedSticker, placingIndex);
      }
    } else {
      const placement = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        xNorm,
        yNorm,
        scale: currentPlacement.scale,
        rotation: currentPlacement.rotation,
        asset: "/assets/sticker0.png",
      };
      const next = [...placements, placement];
      persistPlacements(next);
      setIsPlacing(false);
      setPlacementStep('POSITION');
      setCurrentPlacement(null);
      if (onAddSticker) onAddSticker(placement);
    }
  }, [isPlacing, boardSize, isControlled, internalStickers, placingIndex, placingDefaultScale, placements, persistPlacements, onAddSticker, legacyDefaultScale, onPlaceSticker, placementStep, currentPlacement]);

  return {
    bgImage,
    legacyStickerImage,
    placingImage,
    isPlacing,
    hoverPos,
    boardSize,
    internalStickers,
    placingIndex,
    placingDefaultScale,
    legacyDefaultScale,
    placements,
    isControlled,
    getStickerSrc,
    isValidStickerId,
    enterPlacementMode,
    onStageMouseMove,
    placeSticker,
    persistPlacements,
    finalizeLatestPlacement,
    placementStep,
    currentPlacement,
    isCheersMode,
    cheersStickers,
  };
}